// model
import { Loan, PointsSale } from "./models.js";

// util
import * as DB from "../../utils/db-util.js";
import * as ErrorUtil from "../../utils/error-util.js";
import { getDaysDifference } from "../../utils/date-util.js"; 
import CONSTANTS from "../../config/constants.js"; 

// collaborator services
import * as UserServiceManager from "../user-service/service.js";
import * as EmailServiceManager from "../email-service/service.js";
import * as CashLocationServiceManager from "../cash-location-service/service.js";
import * as DepositServiceManager from "../deposit-service/service.js";

// --- Internal Helper Functions (exported for potential reusability/testing) ---

/**
 * Calculates the borrower's available loan limit based on their investment and existing debts.
 * @param {string} borrowerId - The ID of the borrower.
 * @returns {Promise<number>} The calculated loan limit.
 */
export async function _calculateBorrowerLoanLimit(borrowerId) {
  const user = await UserServiceManager.getUserById(borrowerId);

  const ongoingDebts = await DB.query(Loan.find({
    "borrower.id": new ObjectId(borrowerId),
    status: "Ongoing"
  }));

  const loanLimit = user.investmentAmount * 1.5 - ongoingDebts.reduce((total, loan) => total + loan.principalLeft, 0);
  return loanLimit;
}

/**
 * Calculates the initial financial metrics for a new loan request.
 * @param {number} loanAmount - The requested loan amount.
 * @param {number} loanDuration - The loan duration in months.
 * @param {number} borrowerPoints - The borrower's current points.
 * @returns {object} An object containing totalRate, pointsSpent, actualInterest, installmentAmount.
 */
export function _calculateInitialLoanMetrics(loanAmount, loanDuration, borrowerPoints) {
  const totalRate = CONSTANTS.MONTHLY_LENDING_RATE * loanDuration;
  let pointsNeeded = (loanDuration / 12) < 1.5
    ? Math.max(0, (totalRate - 12)) * loanAmount / 100000
    : 12 * loanAmount / 100000 + (loanDuration - 18) * CONSTANTS.MONTHLY_LENDING_RATE * loanAmount / 100000;

  const pointsSpent = pointsNeeded <= borrowerPoints ? pointsNeeded : borrowerPoints;
  const actualInterest = (totalRate * loanAmount / 100) - (pointsSpent * 1000); // Corrected calculation
  const installmentAmount = Math.round(loanAmount / (1000 * loanDuration)) * 1000;

  return { totalRate, pointsSpent, actualInterest, installmentAmount };
}

/**
 * Deducts funds from specified cash locations.
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number }.
 * @returns {Promise<void>}
 */
export async function _disburseFundsFromSources(sources) {
  await Promise.all(
    sources.map(source =>
      CashLocationServiceManager.deductFromCashLocation(source.id, source.amount)
    )
  );
}

/**
 * Calculates the total interest due for a loan up to a specific payment date.
 * @param {object} loan - The loan document.
 * @param {Date} paymentDate - The date of the current payment.
 * @returns {object} An object containing calculated pointsSpentForLoan and totalInterestDue.
 */
export function _calculateCurrentInterestDue(loan, paymentDate) {
  const thisYear = new Date().getFullYear(); // Current year for comparison
  const loanYear = new Date(loan.date).getFullYear();

  const lastPaymentPeriodDays = getDaysDifference(loan.lastPaymentDate, paymentDate);
  let loanUnits = loan.units + loan.principalLeft * lastPaymentPeriodDays; 

  const totalDaysSinceLoan = getDaysDifference(loan.date, paymentDate);
  let currentLoanDurationMonths = totalDaysSinceLoan / 30;
  currentLoanDurationMonths = (currentLoanDurationMonths % 1 < 0.24) ? Math.trunc(currentLoanDurationMonths) : Math.ceil(currentLoanDurationMonths);

  const daysSinceLastPayment = getDaysDifference(loan.date, loan.lastPaymentDate);
  let lastPaymentDurationMonths = daysSinceLastPayment / 30;
  lastPaymentDurationMonths = (lastPaymentDurationMonths % 1 < 0.24) ? Math.trunc(lastPaymentDurationMonths) : Math.ceil(lastPaymentDurationMonths);

  let currentPrincipalDurationMonths = currentLoanDurationMonths - lastPaymentDurationMonths;

  let pointDays = Math.max(0, Math.min(12, currentLoanDurationMonths) - 6) + Math.max(0, currentLoanDurationMonths - 18);
  let runningRate = CONSTANTS.MONTHLY_LENDING_RATE * (currentLoanDurationMonths - pointDays);

  let pendingInterestAmount = loanYear === thisYear
    ? (1 + CONSTANTS.MONTHLY_LENDING_RATE  / 100) ^ currentPrincipalDurationMonths * loan.principalLeft - loan.principalLeft
    : runningRate * loan.principalLeft / 100;

  let paymentsInterestAmount = 0;
  let totalPayments = 0;
  let pointsSpentForLoan = CONSTANTS.MONTHLY_LENDING_RATE * pointDays * loan.principalLeft / 100000;

  if (loan.payments && loan.payments.length > 0) {
    loan.payments.forEach(payment => {
      const paymentDurationDays = getDaysDifference(loan.date, payment.date);
      let paymentDurationMonths = paymentDurationDays / 30;
      paymentDurationMonths = (paymentDurationMonths % 1 < 0.24) ? Math.trunc(paymentDurationMonths) : Math.ceil(paymentDurationMonths);

      let paymentInterest = CONSTANTS.MONTHLY_LENDING_RATE * (loan.duration - pointDays) * payment.amount / 100;
      let paymentPointDay = Math.max(0, Math.min(12, paymentDurationMonths) - 6) + Math.max(0, paymentDurationMonths - 18);
      pointsSpentForLoan += CONSTANTS.MONTHLY_LENDING_RATE * paymentPointDay * payment.amount / 100000;
      paymentsInterestAmount += paymentInterest;
      totalPayments += payment.amount;
    });
  }

  let totalInterestDue = loanYear === thisYear
    ? pendingInterestAmount
    : pendingInterestAmount + paymentsInterestAmount;

  let currentTotalInterest = loanYear === thisYear
  ? pendingInterestAmount + (totalPayments + loan.principalLeft - loan.amount)
  : totalInterestDue;

  if (totalInterestDue === 0 && loan.principalLeft > 0) {
    totalInterestDue = CONSTANTS.MONTHLY_LENDING_RATE * loan.principalLeft / 100;
  }

  return { totalInterestDue, pointsSpentForLoan, loanUnits, currentTotalInterest };
}

/**
 * Applies a payment to a loan, adjusting principal, interest, and status.
 * Handles excess payments by creating a deposit.
 * @param {object} loan - The loan document (will be mutated).
 * @param {number} paymentAmount - The amount paid.
 * @param {number} totalInterestDue - The total interest calculated as due.
 * @param {object} borrowerUser - The borrower's user document.
 * @param {string} cashLocationId - The ID of the cash location for the payment.
 * @param {object} currentUser - The user making the payment.
 * @returns {Promise<string>} A message describing the payment outcome.
 */
export async function _applyPaymentLogic(loan, pointsSpentForLoan, currentTotalInterest, paymentAmount, totalInterestDue, borrowerUser, cashLocationId, currentUser) {
  let paymentMsg = '';

  if (paymentAmount < (loan.principalLeft + totalInterestDue)) {
    if (paymentAmount >= totalInterestDue) {
      loan.principalLeft -= (paymentAmount - totalInterestDue);
      loan.interestAmount = 0;
    } else {
      loan.interestAmount -= paymentAmount;
    }
  } else { // Payment covers principal and interest, possibly with excess
    const excessAmount = paymentAmount - (loan.principalLeft + totalInterestDue);
    loan.principalLeft = 0;
    loan.interestAmount = currentTotalInterest;
    loan.status = "Ended";
    loan.duration = _calculateCurrentInterestDue(loan, new Date()).currentLoanDurationMonths; 
    loan.pointsSpent = pointsSpentForLoan;
    loan.pointsBalance = loan.pointsSpent - pointsSpentForLoan;

    if (excessAmount >= 5000) {
      await DepositServiceManager.createDeposit({
        depositor: { id: borrowerUser.id, name: borrowerUser.fullName },
        amount: excessAmount,
        cashLocation: { id: cashLocationId, name: 'Automatically Determined' }, 
        source: "Excess Loan Payment",
        date: new Date(),
        recordedBy: { id: currentUser.id, name: currentUser.fullName }
      });
      paymentMsg += `A Deposit of ${excessAmount.toLocaleString('en-US')} was recorded as excess Payment. `;
    }
    paymentMsg += `The Loan is now Ended.`;
  }
  return paymentMsg;
}

/**
 * Updates the loan document in the database.
 * @param {string} loanId - The ID of the loan to update.
 * @param {object} updatedLoanData - The data to update the loan with.
 * @returns {Promise<object>} The update result.
 * @throws {ErrorUtil.AppError} If update fails.
 */
export async function _updateLoanDocument(loanId, updatedLoanData) {
  const loanUpdateResult = await DB.query(Loan.updateOne({ _id: loanId }, { $set: updatedLoanData }));
  if (loanUpdateResult.matchedCount === 0) {
    throw new ErrorUtil.AppError("Failed to update loan. Loan not found or no changes applied.", 500);
  }
  return loanUpdateResult;
}

/**
 * Creates a PointsSale record.
 * @param {object} user - The user involved in the points sale.
 * @param {Date} date - The transaction date.
 * @param {number} pointsAmount - The amount of points involved.
 * @param {object} currentUser - The user recording the transaction.
 */
export async function _recordPointsSale(user, date, pointsAmount, currentUser) {
  await DB.query(PointsSale.create({
    entity: { id: user.id, name: user.fullName },
    date: date,
    pointsWorth: pointsAmount * 1000,
    recordedBy: { id: currentUser.id, name: currentUser.fullName },
    pointsInvolved: pointsAmount,
    reason: "Loan interest",
    type: "Spent"
  }));
}

/**
 * Updates a user's points balance.
 * @param {string} userId - The ID of the user to update.
 * @param {number} pointsChange - The amount to change the points by (positive for add, negative for deduct).
 */
export async function _updateUserPoints(userId, pointsChange) {
  if (pointsChange !== 0) {
    await UserServiceManager.updateUser(userId, { $inc: { "points": pointsChange } });
  }
}

/**
 * Sends an email notification about a loan payment.
 * @param {string} loanStatus - The updated loan status.
 * @param {number} principalLeft - Remaining principal.
 * @param {number} interestAmount - Remaining interest.
 * @param {number} paymentAmount - Amount of the current payment.
 * @param {Date} parsedPaymentDate - Date of the current payment.
 * @param {object} borrowerUser - The borrower's user document.
 */
export async function _sendLoanPaymentNotification(loanStatus, principalLeft, interestAmount, paymentAmount, parsedPaymentDate, borrowerUser) {
  const formattedDate = parsedPaymentDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const notificationParams = {
    amountPaid: paymentAmount,
    date: formattedDate,
    outstandingDebt: principalLeft + interestAmount,
    loanStatus: loanStatus,
    userEmail: borrowerUser.email,
    userFirstName: borrowerUser.displayName || borrowerUser.fullName
  };

  await EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: notificationParams.userEmail,
    subject: "Loan Payment Recorded",
    message: `Dear ${notificationParams.userFirstName},\n\nYour loan payment of ${notificationParams.amountPaid.toLocaleString('en-US')} on ${notificationParams.date} has been recorded.\nOutstanding debt: ${notificationParams.outstandingDebt.toLocaleString('en-US')}\nLoan Status: ${notificationParams.loanStatus}`
  });
}

// --- Loan Service Functions ---

/**
 * Retrieves a list of loans based on filter, sort, and pagination criteria.
 * @param {object} params - Object containing filter, sort, and pagination.
 * @returns {Promise<Array>} A promise that resolves to an array of loan documents.
 */
export async function getFilteredLoans({ filter, sort, pagination }) {
  return await Loan.getFilteredLoans({ filter, sort, pagination });
}

export async function getLoans(status, user) {
  return await DB.query(Loan.find({status: status, "borrower.id": user } ));
}

/**
 * Retrieves a single loan by its ID.
 * @param {string} loanId - The ID of the loan to retrieve.
 * @returns {Promise<object>} A promise that resolves to the loan document.
 * @throws {ErrorUtil.AppError} If the loan is not found.
 */
export async function getLoanById(loanId) {
  const loan = await DB.query(Loan.findById(loanId));
  if (!loan) {
    throw new ErrorUtil.AppError("Loan not found.", 404);
  }
  return loan;
}

/**
 * Initiates a new loan request.
 * @param {number} amount - The requested loan amount.
 * @param {number} duration - The loan duration in months.
 * @param {Date|string} earliestDate - The earliest possible disbursement date.
 * @param {Date|string} latestDate - The latest possible disbursement date.
 * @param {string} borrowerId - The ID of the borrower.
 * @param {object} currentUser - The user initiating the request (from req.user).
 * @returns {Promise<object>} A promise that resolves to the created loan document.
 * @throws {ErrorUtil.AppError} If required information is missing, borrower not found, or loan limit exceeded.
 */
export async function initiateLoanRequest(
  amount,
  duration,
  earliestDate,
  latestDate,
  borrowerId,
  currentUser
) {

  const loanLimit = await _calculateBorrowerLoanLimit(borrowerId);
  if (amount > loanLimit) {
    throw new ErrorUtil.AppError(`The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }

  const borrowerUser = await UserServiceManager.getUserById(borrowerId); // Fetch user again for their points
  const { totalRate, pointsSpent, actualInterest, installmentAmount } =
    _calculateInitialLoanMetrics(amount, duration, borrowerUser.points);

  const today = new Date();
  const newLoan = {
    duration: duration,
    units: 0,
    interestAccrued: 0,
    pointsAccrued: 0,
    rate: totalRate,
    earliestDate: earliestDate,
    latestDate: latestDate,
    status: "Pending Approval",
    installmentAmount: installmentAmount,
    initiatedBy: { id: currentUser.id, name: currentUser.fullName },
    approvedBy: {},
    worthAtLoan: borrowerUser.investmentAmount,
    amount: amount,
    date: today,
    borrower: { id: borrowerUser.id, name: borrowerUser.fullName },
    pointsSpent: pointsSpent,
    discount: 0,
    pointsWorthBought: 0,
    rateAfterDiscount: totalRate,
    interestAmount: actualInterest,
    principalLeft: amount,
    lastPaymentDate: today,
  };

  const createdLoan = await DB.query(Loan.create(newLoan));
  return createdLoan;
}

/**
 * Approves a pending loan request and disburses funds.
 * @param {string} loanId - The ID of the loan to approve.
 * @param {object} approvedBy - The user approving the loan (from req.user).
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number } for disbursement.
 * @returns {Promise<object>} A promise that resolves to the updated loan document.
 * @throws {ErrorUtil.AppError} If loan not found, not pending, total amount mismatch, or insufficient funds.
 */
export async function approveLoan(loanId, approvedBy, sources) {
  const loan = await getLoanById(loanId); // Use getLoanById

  if (loan.status !== "Pending Approval") {
    throw new ErrorUtil.AppError("Loan is not in 'Pending Approval' status.", 400);
  }

  await _disburseFundsFromSources(sources);

  // Update the loan status and details
  const updatedLoan = await DB.query(Loan.updateOne(
    { _id: loanId },
    {
      $set: {
        status: "Ongoing",
        approvedBy: { id: approvedBy.id, name: approvedBy.fullName },
        date: new Date(),
        sources: sources,
      },
    }
  ));

  if (updatedLoan.matchedCount === 0) {
    throw new ErrorUtil.AppError("Failed to approve loan. Loan not found or update failed.", 500);
  }

  return updatedLoan;
}

/**
 * Cancels a pending loan request.
 * @param {string} loanId - The ID of the loan request to cancel.
 * @returns {Promise<object>} A success message if cancelled.
 * @throws {ErrorUtil.AppError} If loan not found or not in pending status.
 */
export async function cancelLoanRequest(loanId) {
  const loan = await getLoanById(loanId); // Use getLoanById

  if (loan.status !== "Pending Approval") {
    throw new ErrorUtil.AppError("Only 'Pending Approval' loans can be cancelled.", 400);
  }

  const updatedLoan = await DB.query(
    Loan.updateOne({ _id: loanId }, { $set: { status: "Cancelled" } })
  );
  if (updatedLoan.matchedCount === 0) {
    throw new ErrorUtil.AppError("Loan request not found or failed to cancel.", 500);
  }
  return { msg: 'Loan request cancelled successfully.' };
}

/**
 * Retrieves all payments for a specific loan.
 * @param {string} loanId - The ID of the loan.
 * @returns {Promise<Array>} An array of payment sub-documents.
 * @throws {ErrorUtil.AppError} If the loan is not found.
 */
export async function getLoanPayments(loanId) {
  const loan = await getLoanById(loanId); // Use getLoanById
  return loan.payments || [];
}

/**
 * Retrieves a specific payment from a loan.
 * @param {string} loanId - The ID of the loan.
 * @param {string} paymentId - The ID of the payment sub-document.
 * @returns {Promise<object>} The payment sub-document.
 * @throws {ErrorUtil.AppError} If loan or payment not found.
 */
export async function getLoanPayment(loanId, paymentId) {
  const loan = await getLoanById(loanId); // Use getLoanById
  const payment = loan.payments.id(paymentId);
  if (!payment) {
    throw new ErrorUtil.AppError("Loan payment not found.", 404);
  }
  return payment;
}

/**
 * Records a new payment for a loan.
 * @param {string} loanId - The ID of the loan.
 * @param {number} paymentAmount - The amount of the payment.
 * @param {Date|string} paymentDate - The date of the payment.
 * @param {string} cashLocationId - The ID of the cash location where the payment was made.
 * @param {object} currentUser - The user recording the payment (from req.user).
 * @returns {Promise<object>} An object containing the new loan status and a message.
 * @throws {ErrorUtil.AppError} If loan not found, invalid payment date, or constants missing.
 */
export async function makeLoanPayment(
  loanId,
  paymentAmount,
  paymentDate,
  cashLocationId,
  currentUser
) {
  const parsedPaymentDate = new Date(paymentDate);
  const loan = await getLoanById(loanId); 

  const borrowerUser = await UserServiceManager.getUserById(loan.borrower.id);

  if (loan.status !== "Ongoing") {
    throw new ErrorUtil.AppError(`Payment cannot be made on a loan with status: '${loan.status}'.`, 400);
  }

  if (new Date(loan.date).getTime() > parsedPaymentDate.getTime()) {
    throw new ErrorUtil.AppError("Payment date cannot be before the loan initiation date!", 400);
  }

  // --- Calculate interest and other metrics ---
  const { totalInterestDue, pointsSpentForLoan, loanUnits, currentTotalInterest } = _calculateCurrentInterestDue(loan, parsedPaymentDate);

  // --- Apply payment logic and get message ---
  let paymentMsg = await _applyPaymentLogic(loan, pointsSpentForLoan, currentTotalInterest, paymentAmount, totalInterestDue, borrowerUser, cashLocationId, currentUser);

  // Add payment to cash location
  await CashLocationServiceManager.addToCashLocation(cashLocationId, paymentAmount);

  // Prepare new payment record for embedding
  const newPaymentRecord = {
    date: parsedPaymentDate,
    amount: paymentAmount,
    updatedBy: { id: currentUser.id, name: currentUser.fullName },
    location: cashLocationId,
  };

  // Update loan document in DB (using the modified loan object properties)
  const updatedLoanData = {
    principalLeft: loan.principalLeft,
    interestAmount: loan.interestAmount,
    units: loanUnits, 
    lastPaymentDate: parsedPaymentDate,
    status: loan.status,
    duration: loan.duration, 
    pointsSpent: pointsSpentForLoan, 
    $push: { payments: newPaymentRecord },
  };

  await _updateLoanDocument(loanId, updatedLoanData);

  paymentMsg += ' Payment was successfully Recorded.';

  // Record PointsSale if points were spent
  await _recordPointsSale(borrowerUser, parsedPaymentDate, pointsSpentForLoan, currentUser);

  // Update borrower's points balance
  await _updateUserPoints(borrowerUser.id, loan.pointsBalance); 

  // Send email notification
  await _sendLoanPaymentNotification(
    loan.status,
    loan.principalLeft,
    loan.interestAmount,
    paymentAmount,
    parsedPaymentDate,
    borrowerUser
  );

  return { loanStatus: loan.status};
}

