// model
import { Loan, PointsSale } from "./models.js";

// util
import * as DB from "../../utils/db-util.js";
import * as ErrorUtil from "../../utils/error-util.js";
import { getDaysDifference } from "../../utils/date-util.js"; 
import { ACCOUNT_BALANCE_RANGES, categorizeAmounts } from "../../utils/financial-analytics-util.js";
import CONSTANTS from "../../src/config/constants.js"; 

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
    status: "Ongoing",
    type: "Interest-Earning"
  }));

  const loanLimit = user.investmentAmount * 1.5 - ongoingDebts.reduce((total, loan) => total + loan.principalLeft, 0);
  return loanLimit;
}

/**
 * Calculates the borrower's available Free-loan amount based on their pastinvestment.
 * @param {string} borrowerId - The ID of the borrower.
 * @returns {Promise<number>} The calculated loan limit for amount and period.
 */
export async function _calculateFreeLoanLimit(borrowerId, amount) {
  const user = await UserServiceManager.getUserById(borrowerId);

  const totalDaysSinceDeposit = getDaysDifference(user.temporaryDate);

  const loanLimit = user.temporarySavingsAmount * CONSTANTS.TEMPORARY_SAVINGS_LOAN_FRACTION;
  const loanPeriodLimit = Math.round((user.temporarySavingsAmount * totalDaysSinceDeposit + user.temporarySavingsUnits) / amount);
  return { loanLimit, loanPeriodLimit };
}


// Helper function for grouping loan records
function groupFinancialRecordsByMonth(records) {
  return records.reduce((acc, record) => {
    const month = new Date(record.date).toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!acc[month]) {
      acc[month] = { records: [], totalInflow: 0, totalOutflow: 0, totalDeposits: 0, totalLoans: 0, totalLoanPayments: 0 };
    }
    acc[month].records.push(record);

    if (record.type === 'Loan') { // Loan disbursement is an outflow
      acc[month].totalOutflow += record.amount;
      acc[month].totalLoans += record.amount;
    } else if (record.type === 'Loan Payment') { // Loan payment is an inflow
      acc[month].totalInflow += record.amount;
      acc[month].totalLoanPayments += record.amount;
    }

    return acc;
  }, {});
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

// --------------------------------- Loan Service Functions -----------------------------------------------

/**
 * Retrieves a list of loans based on filter, sort, and pagination criteria.
 * @param {object} params - Object containing filter, sort, and pagination.
 * @returns {Promise<Array>} A promise that resolves to an array of loan documents.
 */
export async function getFilteredLoans({ filter, sort, pagination }) {
  return await Loan.getFilteredLoans({ filter, sort, pagination });
}

/**
 * Retrieves loans based on provided filters. If a filter is not provided (undefined, null, or empty string),
 * that filter condition is not applied to the query, effectively matching all documents for that field.
 *
 * @param {string | undefined | null} status - The loan status to filter by.
 * @param {string | undefined | null} userId - The ID of the borrower to filter by.
 * @param {string | undefined | null} type - The loan type to filter by.
 * @returns {Promise<Array>} A promise that resolves to an array of loan documents.
 */
export async function getLoans(status, userId, type) {
  const query = {}; 

  if (status !== undefined && status !== null && status !== "") {
    query.status = status;
  }

  if (userId !== undefined && userId !== null && userId !== "") {
    query["borrower.id"] = new mongoose.Types.ObjectId(userId);
  }

  if (type !== undefined && type !== null && type !== "") {
    query.type = type;
  }

  return await DB.tryMongoose(Loan.find(query));
}

/**
 * Summarizes an array of loan documents, calculating various statistics.
 * This function should ideally be called after fetching loans from the database.
 * @param {Array<object>} loans - An array of loan documents (from your Mongoose model).
 * @returns {object} An object containing summarized loan statistics.
 */
export function summarizeLoans(loans) {
  const loansSummary = {
    ongoingLoansCount: 0,
    endedLoansCount: 0,
    totalPrincipal: 0,
    principalLeft: 0,
    interestPaid: 0,
    expectedInterest: 0,
    recievedInterest: 0,
    members: new Set(), 
    membersEndedLoans: new Set(), 
    membersOngoingLoans: new Set(), 
  };

  loans.reduce((acc, cur) => {
    cur.status === "Ongoing"
      ? (acc.ongoingLoansCount += 1)
      : (acc.endedLoansCount += 1);

    acc.totalPrincipal += cur.amount;
    acc.principalLeft += cur.principalLeft;

    cur.status === "Ongoing"
      ? (acc.expectedInterest += _calculateCurrentInterestDue(cur, new Date()).currentTotalInterest) 
      : (acc.interestPaid += cur.interestAmount); 

    acc.recievedInterest += cur.interestAmount;

    // Assuming borrower is an object { id, name }
    if (cur.borrower && cur.borrower.name) {
      acc.members.add(cur.borrower.name);
      cur.status === "Ongoing"
        ? acc.membersOngoingLoans.add(cur.borrower.name)
        : acc.membersEndedLoans.add(cur.borrower.name);
    }
    return acc;
  }, loansSummary);

  return loansSummary;
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
  currentUser, 
) {

  const loanLimit = await _calculateBorrowerLoanLimit(borrowerId);

  if (amount > loanLimit) {
    throw new ErrorUtil.AppError(`The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }


  const borrowerUser = await UserServiceManager.getUserById(borrowerId); 
  const { totalRate, pointsSpent, actualInterest, installmentAmount } = _calculateInitialLoanMetrics(amount, duration, borrowerUser.points);

  const today = new Date();
  const newLoan = {
    duration: duration,
    units: 0,
    interestAccrued: 0,
    pointsAccrued: 0,
    rate: totalRate,
    type: type,
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
 * Fetches all loan-related financial records (loan disbursements and payments).
 * @returns {Promise<Array<object>>} An array of loan and loan payment records.
 */
export async function getLoanFinancialRecords() {
  const loans = await getLoans(); 

  const loanRecords = [];

  loans.forEach(loan => {
    loanRecords.push({
      type: 'Loan',
      amount: loan.amount, 
      date: loan.date,     
      name: loan.borrower.name, 
      source: loan.sources && loan.sources.length > 0
        ? loan.sources.map(s => s.name).join(', ') 
        : 'Not Available',
      isOutflow: true,
    });

    // Add individual loan payments
    if (loan.payments && loan.payments.length > 0) {
      loan.payments.forEach(payment => {
        loanRecords.push({
          type: 'Loan Payment',
          amount: payment.amount, 
          date: payment.date,     
          name: loan.borrower.name, 
          destination: payment.location, 
        });
      });
    }
  });

  return loanRecords;
}

/**
 * Fetches and groups all loan-related financial records (loans and loan payments) by month.
 * @returns {Promise<object>} Monthly grouped financial summaries.
 */
export async function getMonthlyLoanFinancialRecords() {
  const loanRecords = await getLoanFinancialRecords();

  // Sort records by date (most recent first for consistent grouping order)
  loanRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return groupFinancialRecordsByMonth(loanRecords);
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
  const loan = await getLoanById(loanId); 

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


/**
 * Fetches and processes loan records to categorize members based on their total loan amounts,
 * returns each member's total loans with names, and categorizes members by their monthly activity frequency.
 *
 * @param {Array<object>} loanRecords - An array of loan documents, ideally already filtered.
 * Expected structure: { borrower: { id: '...', name: '...' }, amount: number, date: Date, ... }
 * @returns {Promise<object>} An object containing:
 * - standings: Array of loan account standings by range.
 * - memberTotals: Array of objects where each object is { id: string, name: string, total: number }.
 * - activityFrequency: Object detailing monthly activity:
 * - totalMonthsCovered: Number of unique months found in all records.
 * - uniqueMonths: Array of 'YYYY-MM' strings for all unique months.
 * - categories: Array of objects { activity: string, count: number } e.g., "5 out of 7 months": 10 members.
 */
export async function generateLoanAccountStandings(loanRecords) {
    const memberLoanTotalsById = {};
    const memberInfoMap = {};
    const memberMonthlyActivity = new Map(); // Map: memberId -> Set<YYYY-MM>
    const allUniqueMonths = new Set();      // Set of all YYYY-MM strings covered by the records

    loanRecords.forEach(record => {
        const memberId = record.borrower.id.toString();
        const memberName = record.borrower.name;
        const recordDate = new Date(record.date); // Ensure it's a Date object
        const monthYear = `${recordDate.getFullYear()}-${(recordDate.getMonth() + 1).toString().padStart(2, '0')}`;

        // Aggregate total loans per member
        if (!memberLoanTotalsById[memberId]) {
            memberLoanTotalsById[memberId] = 0;
            memberInfoMap[memberId] = memberName;
        }
        memberLoanTotalsById[memberId] += record.amount; // Assuming 'amount' is the disbursed loan amount

        // Track monthly activity for each member
        if (!memberMonthlyActivity.has(memberId)) {
            memberMonthlyActivity.set(memberId, new Set());
        }
        memberMonthlyActivity.get(memberId).add(monthYear);

        // Track all unique months covered by the records
        allUniqueMonths.add(monthYear);
    });

    // --- 1. Generate memberTotals (with names) ---
    const memberLoanTotals = Object.keys(memberLoanTotalsById).map(memberId => ({
        id: memberId,
        name: memberInfoMap[memberId],
        total: memberLoanTotalsById[memberId]
    }));

    // --- 2. Generate standings by amount ---
    const loanStandings = categorizeAmounts(memberLoanTotalsById, ACCOUNT_BALANCE_RANGES);

    // --- 3. Generate activity frequency ---
    const totalMonthsCovered = allUniqueMonths.size;
    const activityCountsByMembers = {}; // Map: numberOfMonthsActive -> countOfMembers

    // Initialize counts for 0 up to totalMonthsCovered
    for (let i = 0; i <= totalMonthsCovered; i++) {
        activityCountsByMembers[i] = 0;
    }

    // Count how many months each member was active
    for (const memberId of Object.keys(memberLoanTotalsById)) { // Iterate through all members who borrowed
        const activeMonthsForMember = memberMonthlyActivity.get(memberId).size;
        activityCountsByMembers[activeMonthsForMember]++;
    }

    // Format activity frequency categories for output
    const activityFrequencyCategories = [];
    Object.keys(activityCountsByMembers).sort((a, b) => b - a).forEach(count => {
        const numMonths = parseInt(count);
        if (activityCountsByMembers[numMonths] > 0) {
            activityFrequencyCategories.push({
                activity: `${numMonths} out of ${totalMonthsCovered} months`,
                count: activityCountsByMembers[numMonths]
            });
        }
    });

    return {
        standings: loanStandings,
        memberTotals: memberLoanTotals,
        activityFrequency: {
            totalMonthsCovered: totalMonthsCovered,
            uniqueMonths: Array.from(allUniqueMonths).sort(),
            categories: activityFrequencyCategories
        }
    };
}


/**----------------------------------------TEMPORARY LOANS---------------------------------------------------------------*/
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
export async function initiateFreeLoanRequest(
  amount,
  duration,
  earliestDate,
  latestDate,
  borrowerId,
  currentUser, 
) {

  const {loanLimit, loanPeriodLimit} = await _calculateFreeLoanLimit(borrowerId);

  if (amount > loanLimit) {
    throw new ErrorUtil.AppError(`The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }

  if (  duration > loanPeriodLimit) {
    throw new ErrorUtil.AppError(`The Loan Period of ${Math.round(loanPeriodLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }

  const borrowerUser = await UserServiceManager.getUserById(borrowerId); 
  const loanUnits = duration * amount; //duration in days

  const today = new Date();
  const newLoan = {
    duration: duration,
    units: loanUnits,
    interestAccrued: 0,
    pointsAccrued: 0,
    rate: 0,
    type: "Interest-Free",
    earliestDate: earliestDate,
    latestDate: latestDate,
    status: "Pending Approval",
    installmentAmount: 0,
    initiatedBy: { id: currentUser.id, name: currentUser.fullName },
    approvedBy: {},
    worthAtLoan: borrowerUser.investmentAmount,
    amount: amount,
    date: today,
    borrower: { id: borrowerUser.id, name: borrowerUser.fullName },
    pointsSpent: 0,
    discount: 0,
    pointsWorthBought: 0,
    rateAfterDiscount: 0,
    interestAmount: 0,
    principalLeft: amount,
    lastPaymentDate: today,
  };

  const createdLoan = await DB.query(Loan.create(newLoan));
  return createdLoan;
}


/**
 * Approves a pending free loan request and disburses funds.
 * @param {string} loanId - The ID of the loan to approve.
 * @param {object} approvedBy - The user approving the loan (from req.user).
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number } for disbursement.
 * @returns {Promise<object>} A promise that resolves to the updated loan document.
 * @throws {ErrorUtil.AppError} If loan not found, not pending, total amount mismatch, or insufficient funds.
 */
export async function approveFreeLoan(loanId, approvedBy, sources) {
  const loan = await getLoanById(loanId);

  if (loan.status !== "Pending Approval") {
    throw new ErrorUtil.AppError("Loan is not in 'Pending Approval' status.", 400);
  }

  await _disburseFundsFromSources(sources);
  //deduct units from total

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
 * Records a new payment for a Free loan.
 * @param {string} loanId - The ID of the loan.
 * @param {number} paymentAmount - The amount of the payment.
 * @param {Date|string} paymentDate - The date of the payment.
 * @param {string} cashLocationId - The ID of the cash location where the payment was made.
 * @param {object} currentUser - The user recording the payment (from req.user).
 * @returns {Promise<object>} An object containing the new loan status and a message.
 * @throws {ErrorUtil.AppError} If loan not found, invalid payment date, or constants missing.
 */
export async function makeFreeLoanPayment(
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

  // --- Apply payment logic. Does not deal with cases of overdue loans ---
  const currentTotalUnits = getDaysDifference(loan.date, parsedPaymentDate) * loan.principalLeft + loan.units;

  if (paymentAmount < loan.principalLeft ) {
      loan.principalLeft -= paymentAmount;
  } else { // Payment covers principal 
    loan.principalLeft = 0;
    loan.units = currentTotalUnits;
    loan.status = "Ended";
    loan.duration = getDaysDifference(loan.date, parsedPaymentDate); 
   }
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
    units: loan.units, 
    lastPaymentDate: parsedPaymentDate,
    status: loan.status,
    duration: loan.duration, 
    $push: { payments: newPaymentRecord },
  };

  await _updateLoanDocument(loanId, updatedLoanData);

  // Send email notification
  await _sendLoanPaymentNotification(
    loan.status,
    loan.principalLeft,
    paymentAmount,
    parsedPaymentDate,
    borrowerUser
  );

  return { loanStatus: loan.status};
}


//----------------------------CODE FOR OTHER SERVICES............................................



//admin-dashboard/service.js (New file for aggregation)

//import { getLoanFinancialRecords } from "../loan-service/service.js";
//import { getDepositFinancialRecords } from "../deposit-service/service.js";
//import * as DB from "../../utils/db-util.js";
//import { User, Deposit } from "../../models/models.js"; 
//import { getHistoricalDepositAccountStandings } from "../deposit-service/service.js"; 

async function analyzeHistoricalDeposits(dateToAnalyze) {
    // 1. Fetch all necessary data from the database ONCE
    const allUsers = await DB.query(User.find().lean());
    const allDeposits = await DB.query(Deposit.find().lean());

    // 2. Call the new historical analysis function, passing the fetched data
    const result = await getHistoricalDepositAccountStandings(dateToAnalyze, allUsers, allDeposits);
    return result;
}


// Helper for grouping (can be a shared utility if used across multiple services)
function groupAllFinancialRecordsByMonth(records) {
    return records.reduce((acc, record) => {
      const month = new Date(record.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!acc[month]) {
        acc[month] = { records: [], totalInflow: 0, totalOutflow: 0, totalDeposits: 0, totalLoans: 0, totalLoanPayments: 0 };
      }
      acc[month].records.push(record);

      if (record.type === 'Loan') {
        acc[month].totalOutflow += record.amount;
        acc[month].totalLoans += record.amount;
      } else if (record.type === 'Loan Payment') {
        acc[month].totalInflow += record.amount;
        acc[month].totalLoanPayments += record.amount;
      } else if (record.type === 'Deposit') {
        acc[month].totalInflow += record.amount;
        acc[month].totalDeposits += record.amount;
      }
      return acc;
    }, {});
}

/**
 * Fetches all financial records (loans, loan payments, and deposits) and groups them by month.
 * @returns {Promise<object>} Monthly grouped financial summaries.
 */
export async function getAllFinancialRecordsGrouped() {
  const [loanRecords, depositRecords] = await Promise.all([
    getLoanFinancialRecords(),
    getDepositFinancialRecords(),
  ]);

  const allCombinedRecords = [...loanRecords, ...depositRecords];

  // Sort records by date (most recent first)
  allCombinedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group the combined records
  return groupAllFinancialRecordsByMonth(allCombinedRecords);
}



// src/services/deposit-service/service.js-------------------------------
//import { ACCOUNT_BALANCE_RANGES, categorizeAmounts } from "../../utils/financial-analytics-util.js";


// Assuming these functions are provided elsewhere in your service/module or globally accessible
// function getDeposit(depositId) { /* ... implementation ... */ }
// function getMemberDeposits(memberId) { /* ... implementation ... */ }


/**
 * Fetches all deposit financial records.
 * @returns {Promise<Array<object>>} An array of deposit records.
 */
export async function getDepositFinancialRecords() {
  const deposits = await DB.query(Deposit.find().lean()); // Fetch all deposits

  const depositRecords = [];

  deposits.forEach(deposit => {
    depositRecords.push({
      type: 'Deposit',
      amount: deposit.amount, // Use 'amount' from schema
      date: deposit.date,     // Use 'date' from schema
      name: deposit.depositor.name, // Use 'depositor.name' from schema
      destination: deposit.cashLocation.name || 'Not Available', // Assuming cashLocation is an object with a name
    });
  });

  return depositRecords;
}

/**
 * Calculates member deposit account balances at a given historical date and categorizes them.
 *
 * @param {Date | string} targetDate - The date for which to calculate balances.
 * @param {Array<object>} allUsers - An array of all user documents from the database.
 * @param {Array<object>} allDeposits - An array of all deposit documents from the database.
 * @returns {Promise<object>} An object containing:
 * - standings: Array of deposit account standings by range for the target date.
 * - memberTotals: Array of objects where each object is { id: string, name: string, total: number }
 * representing the historical combined balance (investment + temporary savings) for eligible members.
 */
export async function getHistoricalDepositAccountStandings(targetDate, allUsers, allDeposits) {
    const analysisDate = new Date(targetDate);
    const currentDate = new Date();

    // Set times to 00:00:00 for accurate date comparison
    currentDate.setHours(0, 0, 0, 0);
    analysisDate.setHours(0, 0, 0, 0);

    const isCurrentDateAnalysis = analysisDate.getTime() === currentDate.getTime();

    // Initialize historical balances based on current user data
    const memberBalancesAtDate = {}; // Stores userId -> { investmentAmount, tempSavingsAmount }
    const memberInfoMap = {};        // Stores userId -> { name, membershipDate }

    allUsers.forEach(user => {
        const userId = user._id.toString();
        memberBalancesAtDate[userId] = {
            investmentAmount: user.investmentAmount || 0,
            tempSavingsAmount: user.tempSavingsAmount || 0
        };
        memberInfoMap[userId] = {
            name: user.fullName || 'Unknown Member',
            membershipDate: user.membershipDate ? new Date(user.membershipDate) : new Date(0) 
        };
    });

    // If analysis is for a historical date, adjust balances by subtracting future deposits
    if (!isCurrentDateAnalysis) {
        allDeposits.forEach(deposit => {
            const depositorId = deposit.depositor._id.toString();
            const depositDate = new Date(deposit.date);

            // Ensure we only process deposits for users we are tracking and that are after the analysis date
            if (memberBalancesAtDate[depositorId] && depositDate > analysisDate) {
                if (deposit.type === "Club Saving") {
                    memberBalancesAtDate[depositorId].investmentAmount -= deposit.amount;
                } else if (deposit.type === "Temporary Saving") {
                    memberBalancesAtDate[depositorId].tempSavingsAmount -= deposit.amount;
                }
            }
        });
    }

    const finalMemberTotalsForCategorization = {}; // userId -> combined total balance for categorization
    const historicalMemberTotals = [];            // Array of { id, name, total } for detailed output

    // Filter by membership date and consolidate balances for final output
    for (const userId in memberBalancesAtDate) {
        if (Object.prototype.hasOwnProperty.call(memberBalancesAtDate, userId)) {
            const memberInfo = memberInfoMap[userId];

            // Only include members who had joined by the analysis date
            if (memberInfo && analysisDate >= memberInfo.membershipDate) {
                const combinedBalance = memberBalancesAtDate[userId].investmentAmount + memberBalancesAtDate[userId].tempSavingsAmount;

                finalMemberTotalsForCategorization[userId] = combinedBalance;
                historicalMemberTotals.push({
                    id: userId,
                    name: memberInfo.name,
                    total: combinedBalance
                });
            }
        }
    }

    // Categorize the historical balances
    const historicalStandings = categorizeAmounts(finalMemberTotalsForCategorization, ACCOUNT_BALANCE_RANGES);

    return {
        standings: historicalStandings,
        memberTotals: historicalMemberTotals
    };
}

/**
 * Fetches and processes deposit records to categorize members based on their total deposit amounts,
 * returns each member's total deposits with names, and categorizes members by their monthly activity frequency.
 *
 * @param {Array<object>} depositRecords - An array of deposit documents, ideally already filtered.
 * Expected structure: { depositor: { id: '...', name: '...' }, amount: number, date: Date, ... }
 * @returns {Promise<object>} An object containing:
 * - standings: Array of deposit account standings by range.
 * - memberTotals: Array of objects where each object is { id: string, name: string, total: number }.
 * - activityFrequency: Object detailing monthly activity:
 * - totalMonthsCovered: Number of unique months found in all records.
 * - uniqueMonths: Array of 'YYYY-MM' strings for all unique months.
 * - categories: Array of objects { activity: string, count: number } e.g., "5 out of 7 months": 10 members.
 */
export async function generateDepositAccountStandings(depositRecords) {
    const memberDepositTotalsById = {};
    const memberInfoMap = {};
    const memberMonthlyActivity = new Map(); // Map: memberId -> Set<YYYY-MM>
    const allUniqueMonths = new Set();      // Set of all YYYY-MM strings covered by the records

    depositRecords.forEach(record => {
        const memberId = record.depositor.id.toString();
        const memberName = record.depositor.name;
        const recordDate = new Date(record.date); // Ensure it's a Date object
        const monthYear = `${recordDate.getFullYear()}-${(recordDate.getMonth() + 1).toString().padStart(2, '0')}`;

        // Aggregate total deposits per member
        if (!memberDepositTotalsById[memberId]) {
            memberDepositTotalsById[memberId] = 0;
            memberInfoMap[memberId] = memberName;
        }
        memberDepositTotalsById[memberId] += record.amount;

        // Track monthly activity for each member
        if (!memberMonthlyActivity.has(memberId)) {
            memberMonthlyActivity.set(memberId, new Set());
        }
        memberMonthlyActivity.get(memberId).add(monthYear);

        // Track all unique months covered by the records
        allUniqueMonths.add(monthYear);
    });

    // --- 1. Generate memberTotals (with names) ---
    const memberDepositTotals = Object.keys(memberDepositTotalsById).map(memberId => ({
        id: memberId,
        name: memberInfoMap[memberId],
        total: memberDepositTotalsById[memberId]
    }));

    // --- 2. Generate standings by amount ---
    const depositStandings = categorizeAmounts(memberDepositTotalsById, ACCOUNT_BALANCE_RANGES);

    // --- 3. Generate activity frequency ---
    const totalMonthsCovered = allUniqueMonths.size;
    const activityCountsByMembers = {}; // Map: numberOfMonthsActive -> countOfMembers

    // Initialize counts for 0 up to totalMonthsCovered
    for (let i = 0; i <= totalMonthsCovered; i++) {
        activityCountsByMembers[i] = 0;
    }

    // Count how many months each member was active
    for (const memberId of Object.keys(memberDepositTotalsById)) { // Iterate through all members who deposited
        const activeMonthsForMember = memberMonthlyActivity.get(memberId).size;
        activityCountsByMembers[activeMonthsForMember]++;
    }

    // Format activity frequency categories for output
    const activityFrequencyCategories = [];
    // Sort activity counts in descending order for display
    Object.keys(activityCountsByMembers).sort((a, b) => b - a).forEach(count => {
        const numMonths = parseInt(count);
        if (activityCountsByMembers[numMonths] > 0) { // Only include categories with members
            activityFrequencyCategories.push({
                activity: `${numMonths} out of ${totalMonthsCovered} months`,
                count: activityCountsByMembers[numMonths]
            });
        }
    });

    return {
        standings: depositStandings,
        memberTotals: memberDepositTotals,
        activityFrequency: {
            totalMonthsCovered: totalMonthsCovered,
            uniqueMonths: Array.from(allUniqueMonths).sort(), // Sorted for consistent output
            categories: activityFrequencyCategories
        }
    };
}

// ... (other functions related to deposits) ...

