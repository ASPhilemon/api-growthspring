//GENERAL_REQUESTS
//STANDARD_LOAN_FUNCTIONS
//INITIATE_STD_LOAN
//APPROVE_STD_LOAN
//PROCESS_STD_LOAN_PYMT
//TEMPORARY_LOANS



// model
import { Loan } from "./models.js";
import mongoose from "mongoose"; 

// util
import * as DB from "../../utils/db-util.js";
import * as ErrorUtil from "../../utils/error-util.js";
import { getDaysDifference } from "../../utils/date-util.js";
import CONSTANTS from "../../src/config/constants.js";

// collaborator services
import * as UserServiceManager from "../user-service/service.js";
import * as EmailServiceManager from "../email-service/service.js";
import * as CashLocationServiceManager from "../cash-location-service/service.js";
import * as DepositServiceManager from "../deposit-service/service.js";
import * as PointsServiceManager from "../point-service/service.js";

//.......................GENERAL HELPER FUNCTIONS..............................
// Assuming CONSTANTS has these values or they are defined internally
const ONE_MONTH_DAYS = 30;
const GRACE_PERIOD_DAYS = 7;
const ONE_YEAR_MONTH_THRESHOLD = 6;
const TWO_YEAR_MONTH_THRESHOLD = 18;
const ONE_YEAR_MONTHS = 12;

/**
 * Calculates total number of unpaid/due months considering a grace period.
 * @param {Date} startDate - The start date for calculation.
 * @param {Date} endDate - The end date for calculation.
 * @returns {number} The total number of months due.
 */
function calculateTotalMonthsDue(startDate, endDate) {
  let daysDifference = getDaysDifference(startDate, endDate);
  let months = Math.floor(daysDifference / ONE_MONTH_DAYS);
  let daysIntoMonth = daysDifference % ONE_MONTH_DAYS;

  // Apply grace period: if days into month is within grace period, don't count it as a full month
  if (daysIntoMonth > 0 && daysIntoMonth <= GRACE_PERIOD_DAYS) {
    // If it's just the grace period and no full months, then 1
    months = months === 0 ? 1 : months; 
  } else if (daysIntoMonth > GRACE_PERIOD_DAYS) {
    // If days into month exceeds grace period, count it as an additional month
    months += 1;
  }
  return months;
}

/**
 * Calculates the number of months whose interest can be cleared with points given a loan duration.
 * This is about the *total* point-eligible months based on the loan's life.
 * @param {Date} loanStartDate - The original loan start date.
 * @param {Date} calculationEndDate - The date up to which to calculate the loan duration.
 * @returns {number} The number of point-eligible months.
 */
function calculatePointMonthsAccrued(loanStartDate, calculationEndDate) {
  const totalDaysSinceLoan = getDaysDifference(loanStartDate, calculationEndDate);
  // Convert days to months, assuming 30 days per month
  let loanDurationMonths = totalDaysSinceLoan / 30;
  // Apply the 0.24 rule for rounding up/down for month calculation as a way to consider grace period.
  loanDurationMonths = (loanDurationMonths % 1 < 0.24) ? Math.trunc(loanDurationMonths) : Math.ceil(loanDurationMonths);

  if (loanDurationMonths <= ONE_YEAR_MONTH_THRESHOLD) return 0;
  if (loanDurationMonths <= ONE_YEAR_MONTHS) return loanDurationMonths - ONE_YEAR_MONTH_THRESHOLD;
  if (loanDurationMonths <= TWO_YEAR_MONTH_THRESHOLD) return ONE_YEAR_MONTH_THRESHOLD; 
  return loanDurationMonths - ONE_YEAR_MONTHS; 
}

/**
 * Fetches a loan by its ID. Throws an error if not found.
 * @param {string} loanId - The ID of the loan.
 * @returns {Promise<object>} The loan document.
 * @throws {ErrorUtil.AppError} If loan is not found.
 */
export async function getLoanById(loanId) {
  const loan = await DB.query(Loan.findById(loanId));
  if (!loan) {
    throw new ErrorUtil.AppError("Loan not found.", 404);
  }
  return loan;
}

/**
 * Sends an email notification about a loan payment.
 * @param {object} params - Parameters for the email notification.
 * @param {string} params.loanStatus - The updated loan status.
 * @param {number} params.principalLeft - Remaining principal.
 * @param {number} params.interestAmount - Remaining interest.
 * @param {number} params.paymentAmount - Amount of current payment.
 * @param {Date} params.paymentDate - Date of current payment.
 * @param {object} params.borrowerUser - Borrower's user document.
 */
export async function sendLoanPaymentNotification(params) {
  const formattedDate = params.paymentDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const notificationParams = {
    amountPaid: params.paymentAmount,
    date: formattedDate,
    outstandingDebt: params.principalLeft + params.interestAmount,
    loanStatus: params.loanStatus,
    userEmail: params.borrowerUser.email,
    userFirstName: params.borrowerUser.displayName || params.borrowerUser.fullName
  };

  await EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: notificationParams.userEmail,
    subject: "Loan Payment Recorded",
    message: `Dear ${notificationParams.userFirstName},\n\nYour loan payment of ${notificationParams.amountPaid.toLocaleString('en-US')} on ${notificationParams.date} has been recorded.\nOutstanding debt: ${notificationParams.outstandingDebt.toLocaleString('en-US')}\nLoan Status: ${notificationParams.loanStatus}`
  });
}

/**
 * Creates and persists a new loan document with common properties.
 * This function abstracts the core loan document construction and database insertion.
 *
 * @param {object} params - Object containing all necessary parameters for loan creation.
 * @returns {Promise<object>} A promise that resolves to the created loan document.
 */
export async function createAndPersistLoan(params) {
  const today = new Date();

  const newLoan = {
    duration: params.duration,
    units: params.loanUnits,
    interestAccrued: 0, 
    pointsAccrued: 0, 
    rate: params.rate,
    type: params.type,
    earliestDate: params.earliestDate,
    latestDate: params.latestDate,
    status: "Pending Approval",
    installmentAmount: params.installmentAmount,
    initiatedBy: { id: params.currentUser.id, name: params.currentUser.fullName },
    approvedBy: {},
    worthAtLoan: params.borrowerUser.investmentAmount,
    amount: params.amount,
    date: today,
    borrower: { id: params.borrowerUser.id, name: params.borrowerUser.fullName },
    pointsSpent: params.pointsSpent,
    discount: 0,
    pointsWorthBought: 0,
    rateAfterDiscount: params.rateAfterDiscount,
    interestAmount: params.interestAmount,
    principalLeft: params.amount,
    lastPaymentDate: today,
  };

  const createdLoan = await DB.tryMongoose(Loan.create(newLoan));
  return createdLoan;
}

//....................................GENERAL_REQUESTS.....................................


/**
 * Retrieves a list of loans based on filter, sort, and pagination criteria.
 * @param {object} params - Object containing filter, sort, and pagination.
 * @returns {Promise<Array>} A promise that resolves to an array of loan documents.
 */
export async function getLoans({ filter, sort, pagination }) {
  // Assuming Loan.getFilteredLoans is a static method on the Mongoose model
  return await Loan.getLoans({ filter, sort, pagination });
}

/**
 * Cancels a pending loan request.
 * @param {string} loanId - The ID of the loan request to cancel.
 * @returns {Promise<object>} A success message if cancelled.
 * @throws {ErrorUtil.AppError} If loan not found or not in pending status.
 */
export async function cancelLoanRequest(loanId) {
  const loan = await getLoanById(loanId);

  if (loan.status !== "Pending Approval") {
    throw new ErrorUtil.AppError("Only 'Pending Approval' loans can be cancelled.", 400);
  }

  const updatedLoanResult = await updateLoanRecord(loanId, { status: "Cancelled" });
  if (updatedLoanResult.matchedCount === 0) {
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
  const loan = await getLoanById(loanId);
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
  const loan = await getLoanById(loanId);
  const payment = loan.payments.id(paymentId);
  if (!payment) {
    throw new ErrorUtil.AppError("Loan payment not found.", 404);
  }
  return payment;
}


//..................................STANDARD_LOAN_FUNCTIONS.....................................

//.............INITIATE_STD_LOAN
/**
 * Initiates a new loan request.
 * @param {number} amount - The requested loan amount.
 * @param {number} duration - The loan duration in months.
 * @param {Date|string} earliestDate - The earliest possible disbursement date.
 * @param {Date|string} latestDate - The latest possible disbursement date.
 * @param {string} borrowerId - The ID of the borrower.
 * @param {object} currentUser - The user initiating the request.
 * @returns {Promise<object>} A promise that resolves to the created loan document.
 * @throws {ErrorUtil.AppError} If required information is missing, borrower not found, or loan limit exceeded.
 */
export async function initiateStandardLoanRequest(
  amount,
  duration,
  earliestDate,
  latestDate,
  borrowerId,
  currentUser,
) {

  const loanLimit = await calculateStandardLoanLimit(borrowerId);
  if (amount > loanLimit) {
    throw new ErrorUtil.AppError(`The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }

  const borrowerUser = await UserServiceManager.getUserById(borrowerId);
  if (!borrowerUser) {
    throw new ErrorUtil.AppError("Borrower not found.", 404);
  }

  const { totalRate, pointsSpent, actualInterest, installmentAmount } =
    calculateStandardLoanRequestMetrics(amount, duration, borrowerUser.points);

  const createdLoan = await createAndPersistLoan({
    amount,
    duration,
    earliestDate,
    latestDate,
    borrowerUser,
    currentUser,
    rate: totalRate,
    type: "Standard",
    loanUnits: 0, 
    interestAmount: actualInterest,
    installmentAmount: installmentAmount,
    pointsSpent: pointsSpent,
    rateAfterDiscount: totalRate 
  });

  return createdLoan;
}

/**
 * Calculates the borrower's available standard loan limit based on their investment and existing debts.
 * @param {string} borrowerId - The ID of the borrower.
 * @returns {Promise<number>} The calculated loan limit.
 */
export async function calculateStandardLoanLimit(borrowerId) {
  const user = await UserServiceManager.getUserById(borrowerId);

  const ongoingDebts = await DB.query(Loan.find({
    "borrower.id": new mongoose.Types.ObjectId(borrowerId),
    status: "Ongoing",
    type: "Standard"
  }));

  const totalOngoingPrincipal = ongoingDebts.reduce((total, loan) => total + loan.principalLeft, 0);
  return user.investmentAmount * CONSTANTS.LOAN_INVESTMENT_MULTIPLIER - totalOngoingPrincipal;
}

/**
 * Calculates the initial financial metrics for a new standard loan request.
 * Encapsulates the logic for total rate, actual interest, and installment.
 * @param {number} loanAmount - The requested loan amount.
 * @param {number} loanDuration - The loan duration in months.
 * @param {number} borrowerPoints - The borrower's current points.
 * @returns {object} An object containing totalRate, pointsSpent, actualInterest, installmentAmount.
 */
export function calculateStandardLoanRequestMetrics(loanAmount, loanDuration, borrowerPoints) {
  const totalRate = CONSTANTS.MONTHLY_LENDING_RATE * loanDuration;

  const { pointsSpent } = calculateLoanPointsNeeded(loanAmount, loanDuration, borrowerPoints, totalRate);

  const actualInterest = (totalRate * loanAmount / 100) - (pointsSpent * CONSTANTS.POINTS_VALUE_PER_UNIT);
  const installmentAmount = Math.round(loanAmount / (CONSTANTS.POINTS_VALUE_PER_UNIT * loanDuration)) * CONSTANTS.POINTS_VALUE_PER_UNIT;

  return { totalRate, pointsSpent, actualInterest, installmentAmount };
}

/**
 * Calculates the points needed and points spent for a loan based on its duration and amount.
 * @param {number} loanAmount - The requested loan amount.
 * @param {number} loanDuration - The loan duration in months.
 * @param {number} borrowerPoints - The borrower's current available points.
 * @param {number} totalRate - The calculated total interest rate for the loan.
 * @returns {object} An object containing pointsNeeded and pointsSpent.
 */
export function calculateLoanPointsNeeded(loanAmount, loanDuration, borrowerPoints, totalRate) {
  let pointsNeeded;

  // points needed based on loan duration
  if ((loanDuration / 12) < 1.5) {
    pointsNeeded = Math.max(0, (totalRate - 12)) * loanAmount / CONSTANTS.POINTS_CONVERSION_RATE_DIVISOR;
  } else {
    pointsNeeded = (12 * loanAmount / CONSTANTS.POINTS_CONVERSION_RATE_DIVISOR) +
                   ((loanDuration - 18) * CONSTANTS.MONTHLY_LENDING_RATE * loanAmount / CONSTANTS.POINTS_CONVERSION_RATE_DIVISOR);
  }

  // Determine actual points spent, limited by available points
  const pointsSpent = Math.min(pointsNeeded, borrowerPoints);

  return { pointsNeeded, pointsSpent };
}

//....................APPROVE_STD_LOAN
/**
 * Approves a pending loan request and disburses funds.
 * @param {string} loanId - The ID of the loan to approve.
 * @param {object} approvedBy - The user approving the loan.
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number } for disbursement.
 * @returns {Promise<object>} A promise that resolves to the updated loan document.
 * @throws {ErrorUtil.AppError} If loan not found, not pending, or disbursement fails.
 */
export async function approveStandardLoanRequest(loanId, approvedBy, sources) {
  const loan = await getLoanById(loanId);

  if (loan.status !== "Pending Approval") {
    throw new ErrorUtil.AppError("Loan is not in 'Pending Approval' status.", 400);
  }

  // Deduct funds from cash locations
  await Promise.all(
    sources.map(source =>
      CashLocationServiceManager.addToCashLocation(source.id, -source.amount)
    )
  );

  // Update the loan status and details
  const updatedLoanResult = await updateLoanRecord(loanId, {
    status: "Ongoing",
    approvedBy: { id: approvedBy.id, name: approvedBy.fullName },
    date: new Date(), 
    sources: sources,
    lastPaymentDate: new Date(), 
  });

  return updatedLoanResult;
}

//............PROCESS_STD_LOAN_PYMT
/**
 * Processes a loan payment, updating loan status, user points, and sending notifications.
 * This is a high-level orchestration function.
 * @param {string} loanId - The ID of the loan being paid.
 * @param {number} paymentAmount - The amount paid.
 * @param {string} cashLocationId - The ID of the cash location where payment was received.
 * @param {object} currentUser - The user recording the payment.
 * @returns {Promise<object>} The updated loan document and a payment message.
 */
export async function processStandardLoanPayment(loanId, paymentAmount, cashLocationId, currentUser, paymentDate) {
  const loan = await getLoanById(loanId);
  const borrowerUser = await UserServiceManager.getUserById(loan.borrower.id);

  if (!borrowerUser) {
    throw new ErrorUtil.AppError("Borrower user not found for loan payment processing.", 404);
  }

  const totalInterestDue = calculateTotalInterestDueAmount(loan, paymentDate);
  const pointsInterestDue = calculatePointsInterestDueAmount(loan, borrowerUser.points, paymentDate);

  // Distribute payment to principal and interest
  const paymentDistribution = calculateStandardLoanPrincipalLeft(paymentAmount, totalInterestDue, loan.principalLeft);

  // Handle excess payment if any
  if (paymentDistribution.excessAmount > 0) {
    await handleExcessPayment(paymentDistribution.excessAmount, borrowerUser, cashLocationId, currentUser);
  }

  // Record points consumption and update user balance
  const pointsConsumed = calculatePointsConsumed(pointsInterestDue);
  if (pointsConsumed > 0) {
    await PointsServiceManager.redeemPoints(borrowerUser.id, pointsConsumed, 'Loan Interest', '');
    await updateUserPointsBalance(borrowerUser.id, -pointsConsumed);
  }

  // Update loan properties based on payment distribution and points consumed
  updateLoanAfterPayment(loan, paymentDistribution, (loan.pointsSpent || 0) + pointsConsumed);

  // Add the current payment to the loan's payments array
  loan.payments.push({
    amount: paymentAmount,
    date: new Date(),
    location: cashLocationId,
    recordedBy: { id: currentUser.id, name: currentUser.fullName }
  });

  // Add payment to cash location (inflow)
  await CashLocationServiceManager.addToCashLocation(cashLocationId, paymentAmount);

  // Persist the updated loan document
  const updatedLoanRecordResult = await DB.query(loan.save());

  // Send notification
  await sendLoanPaymentNotification({
    loanStatus: loan.status,
    principalLeft: loan.principalLeft,
    interestAmount: loan.interestAmount,
    paymentAmount: paymentAmount,
    paymentDate: new Date(),
    borrowerUser: borrowerUser
  });

  return { updatedLoanRecordResult };
}

/**
 * Determines the payment distribution (how much goes to interest, how much to principal).
 * @param {number} paymentAmount - The total amount paid.
 * @param {number} totalInterestDue - The total calculated interest due.
 * @param {number} principalLeft - The remaining principal.
 * @returns {object} { interestPaid: number, principalPaid: number, excessAmount: number }
 */
export function calculateStandardLoanPrincipalLeft(paymentAmount, totalInterestDue, principalLeft) {
  let interestPaid = 0;
  let principalPaid = 0;
  let excessAmount = 0;

  const totalOutstanding = principalLeft + totalInterestDue;

  if (paymentAmount >= totalOutstanding) {
    interestPaid = totalInterestDue;
    principalPaid = principalLeft;
    excessAmount = paymentAmount - totalOutstanding;
  } else if (paymentAmount >= totalInterestDue) {
    interestPaid = totalInterestDue;
    principalPaid = paymentAmount - totalInterestDue;
  } else { 
    interestPaid = paymentAmount;
    principalPaid = 0;
  }

  return { interestPaid, principalPaid, excessAmount };
}

/**
 * Calculates unpaid/due interest on a loan that must be cleared with cash/money (points cannot be used).
 * @param {object} loan - The loan document.
 * @param {Date} dueDate - The date up to which interest is calculated.
 * @param {number} availablePoints - The borrower's current available points.
 * @returns {number} The interest amount that must be paid with cash.
 */
export function calculateCashInterestDueAmount(loan, dueDate, availablePoints) {
  const totalInterestDue = calculateTotalInterestDueAmount(loan, dueDate);
  const pointsInterestDue = calculatePointsInterestDueAmount(loan, availablePoints, dueDate);
  return totalInterestDue - pointsInterestDue;
}

/**
 * Calculates the number of points consumed if the interest is paid with points.
 * @param {number} pointsInterestDueAmount - The interest amount being paid by points.
 * @returns {number} The number of points required.
 */
export function calculatePointsConsumed(pointsInterestDueAmount) {
  return pointsInterestDueAmount / CONSTANTS.POINTS_VALUE_PER_UNIT;
}

/**
 * Calculates unpaid/due interest on a loan that can be cleared using available points.
 * @param {object} loan - The loan document.
 * @param {number} availablePoints - The borrower's current available points.
 * @param {Date} dueDate - The date up to which interest is calculated.
 * @returns {number} The interest amount that can be cleared by points.
 */
function calculatePointsInterestDueAmount(loan, availablePoints, dueDate) {
  const totalInterestDue = calculateTotalInterestDueAmount(loan, dueDate);
  const totalMonthsDue = calculateTotalMonthsDue(loan.lastPaymentDate, dueDate);
  const pointMonthsDue = calculatePointsMonthsDue(loan.date, loan.lastPaymentDate, dueDate);

  let pointsInterestDue = 0;
  if (totalMonthsDue > 0) { 
    pointsInterestDue = totalInterestDue * (pointMonthsDue / totalMonthsDue);
  }

  // Ensure pointsInterestDue doesn't exceed what availablePoints can cover
  pointsInterestDue = Math.min(pointsInterestDue, availablePoints * CONSTANTS.POINTS_VALUE_PER_UNIT);
  return pointsInterestDue;
}

/**
 * Calculates the total unpaid/due interest on a loan.
 * @param {object} loan - The loan document.
 * @param {Date} dueDate - The date up to which interest is calculated.
 * @returns {number} The total interest due.
 */
function calculateTotalInterestDueAmount(loan, dueDate) {
  
  const totalMonthsDue = calculateTotalMonthsDue(loan.lastPaymentDate, dueDate);
  const MONTHLY_INTEREST_RATE = CONSTANTS.MONTHLY_LENDING_RATE / 100; 
  let totalAmount = loan.principalLeft * Math.pow((1 + MONTHLY_INTEREST_RATE), totalMonthsDue);
  return totalAmount - loan.principalLeft;
}

/**
 * Calculates number of unpaid/due months whose interest can be cleared with points.
 * @param {Date} loanStartDate - The original loan start date.
 * @param {Date} lastPaymentDate - The date of the last payment.
 * @param {Date} currentDueDate - The current date for calculating due months.
 * @returns {number} The number of point-eligible months due.
 */
function calculatePointsMonthsDue(loanStartDate, lastPaymentDate, currentDueDate) {
  const totalPointMonthsAccrued = calculatePointMonthsAccrued(loanStartDate, currentDueDate);
  const clearedPointMonths = calculatePointMonthsAccrued(loanStartDate, lastPaymentDate);
  return totalPointMonthsAccrued - clearedPointMonths;
}

/**
 * Adjusts a user's points balance.
 * @param {string} userId - ID of the user.
 * @param {number} pointsChange - Amount to change (positive for add, negative for deduct).
 */
export async function updateUserPointsBalance(userId, pointsChange) {
  if (pointsChange !== 0) {
    await UserServiceManager.updateUser(userId, { $inc: { "points": pointsChange } });
  }
}

/**
 * Updates the loan document based on payment distribution.
 * @param {object} loan - The loan document (to be mutated).
 * @param {object} paymentDistribution - Result from calculateStandardLoanPrincipalLeft.
 * @param {number} currentTotalInterestAccrued - The total accumulated interest on the loan (not just due interest).
 * @param {number} pointsSpentOnLoan - The total points spent on this loan so far.
 */
export function updateLoanAfterPayment(loan, paymentDistribution, currentTotalInterestAccrued, pointsSpentOnLoan) {
  const { interestPaid, principalPaid } = paymentDistribution;

  loan.principalLeft -= principalPaid;
  loan.interestAmount += interestPaid; 

  // If loan is fully paid
  if (loan.principalLeft <= 0 && loan.interestAmount <= 0) {
    loan.principalLeft = 0; 
    loan.status = "Ended";
    loan.duration = calculateTotalMonthsDue(loan.date, new Date()); 
    loan.pointsSpent = pointsSpentOnLoan; 
    loan.interestAmount = currentTotalInterestAccrued;
  }
  loan.lastPaymentDate = new Date(); 
}

/**
 * Handles creation of deposit for excess loan payments.
 * @param {number} excessAmount - The amount of excess payment.
 * @param {object} borrowerUser - The borrower's user document.
 * @param {string} cashLocationId - The ID of the cash location.
 * @param {object} currentUser - The user recording the transaction.
 * @returns {Promise<string>} A message if a deposit was created.
 */
async function handleExcessPayment(excessAmount, borrowerUser, cashLocationId, currentUser) {
  if (excessAmount >= CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD) { // Assuming 5000 is a constant
    await DepositServiceManager.createDeposit({
      depositor: borrowerUser.id,
      amount: excessAmount,
      type: "club saving",
      cashLocation: { _id: cashLocationId, name: 'Automatically Determined' },
      source: "Excess Loan Payment",
      date: new Date(),
      recordedBy: { _id: currentUser.id, fullName: currentUser.fullName }
    });
    return '';
  }
  return '';
}

/**----------------------------------------TEMPORARY_LOANS---------------------------------------------------------------*/

/**
 * Initiates a new free loan request.
 * @param {number} amount - The requested loan amount.
 * @param {number} duration - The loan duration in months.
 * @param {Date|string} earliestDate - The earliest possible disbursement date.
 * @param {Date|string} latestDate - The latest possible disbursement date.
 * @param {string} borrowerId - The ID of the borrower.
 * @param {object} currentUser - The user initiating the request.
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
  const borrowerUser = await UserServiceManager.getUserById(borrowerId);
  if (!borrowerUser) {
    throw new ErrorUtil.AppError("Borrower not found.", 404);
  }

  const { loanLimit, loanPeriodLimit } = calculateFreeLoanEligibility(borrowerUser, amount, duration);

  if (amount > loanLimit) {
    throw new ErrorUtil.AppError(`The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }

  if (duration > loanPeriodLimit) {
    throw new ErrorUtil.AppError(`The Loan Period of ${Math.round(loanPeriodLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }

  const loanUnits = duration * amount;

  const createdLoan = await createAndPersistLoan({
    amount,
    duration,
    earliestDate,
    latestDate,
    borrowerUser,
    currentUser,
    rate: 0,
    type: "Interest-Free",
    loanUnits: loanUnits,
    interestAmount: 0,
    installmentAmount: 0,
    pointsSpent: 0,
    rateAfterDiscount: 0
  });

  return createdLoan;
}

/**
 * Calculates the borrower's available Free-loan amount and period based on their past investment.
 * @param {object} user - The borrower's user document.
 * @param {number} requestedAmount - The requested loan amount (used for period calculation).
 * @returns {object} An object containing loanLimit and loanPeriodLimit.
 */
export function calculateFreeLoanEligibility(user, requestedAmount, requestedPeriod) {
  const totalDaysSinceDeposit = getDaysDifference(user.temporaryDate, new Date()); 
  
  const loanPeriodLimit = requestedAmount > 0
    ? Math.round((user.temporarySavingsAmount * totalDaysSinceDeposit + user.temporarySavingsUnits) / requestedAmount)
    : 0;

  const loanLimit = requestedPeriod > 0
  ? Math.round((user.temporarySavingsAmount * totalDaysSinceDeposit + user.temporarySavingsUnits) / requestedPeriod)
  : 0;    
  return { loanLimit, loanPeriodLimit };
}

/**
 * Approves a pending free loan request and disburses funds.
 * @param {string} loanId - The ID of the loan to approve.
 * @param {object} approvedBy - The user approving the loan.
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number } for disbursement.
 * @returns {Promise<object>} A promise that resolves to the updated loan document.
 * @throws {ErrorUtil.AppError} If loan not found, not pending, or disbursement fails.
 */
export async function approveFreeLoan(loanId, approvedBy, sources) {
  const loan = await getLoanById(loanId);

  if (loan.status !== "Pending Approval") {
    throw new ErrorUtil.AppError("Loan is not in 'Pending Approval' status.", 400);
  }

  await Promise.all(
    sources.map(source =>
      CashLocationServiceManager.addToCashLocation(source.id, -source.amount)
    )
  );

  await UserServiceManager.addTemporaryInvestmentUnits(loan.borrower.id, -loan.units);

  const updatedLoanResult = await updateLoanRecord(loanId, {
    status: "Ongoing",
    approvedBy: { id: approvedBy.id, name: approvedBy.fullName },
    date: new Date(), 
    units: 0,
    sources: sources,
    lastPaymentDate: new Date(), 
  });

  return updatedLoanResult;
}

/**
 * Records a new payment for a Free loan.
 * @param {string} loanId - The ID of the loan.
 * @param {number} paymentAmount - The amount of the payment.
 * @param {Date|string} paymentDate - The date of the payment.
 * @param {string} cashLocationId - The ID of the cash location where the payment was made.
 * @param {object} currentUser - The user recording the payment.
 * @returns {Promise<object>} An object containing the new loan status and a message.
 * @throws {ErrorUtil.AppError} If loan not found, invalid payment date, or not an ongoing loan.
 */
export async function processFreeLoanPayment(
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

  // Apply loan-specific payment logic
  await calculateFreeLoanPrincipleLeft(loan, paymentAmount, parsedPaymentDate);

  // Add payment to cash location (inflow)
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

  await updateLoanRecord(loanId, updatedLoanData);

  // Send email notification 
  await sendLoanPaymentNotification({
    loanStatus: loan.status,
    principalLeft: loan.principalLeft,
    interestAmount: loan.interestAmount, 
    paymentAmount: paymentAmount,
    paymentDate: parsedPaymentDate,
    borrowerUser: borrowerUser
  });

  return '';
}


/**
 * Applies the specific payment logic for Free Loans, considering principal, excess units, and cash interest.
 * This function updates the loan document's state based on the payment.
 *
 * @param {object} user - The borrower's user document.
 * @param {object} loan - The loan document (mutated by this function).
 * @param {number} paymentAmount - The amount of the payment.
 * @param {Date} parsedPaymentDate - The date of the payment.
 * @returns {string} A message indicating any specific outcome (e.g., loan ended).
 */
async function calculateFreeLoanPrincipleLeft(user, loan, paymentAmount, parsedPaymentDate) {
  const { currentLoanUnits, cashInterest, excessUnits, currentTempSavingsUnits } = await calculateFreeLoanOverdueMetrics(loan, user, parsedPaymentDate);

  if (paymentAmount < loan.principalLeft) {
    handlePartialPrincipalPayment(loan, paymentAmount);
  } else if (excessUnits > 0 && cashInterest === 0) {
    await handleExcessUnitsNoCashInterest(user, loan, currentTempSavingsUnits, excessUnits, parsedPaymentDate); 
  } else if (cashInterest > 0) {
    await handleCashInterestPayment(user, loan, paymentAmount, cashInterest, parsedPaymentDate);
  } else {
    loan.principalLeft = 0;
    loan.status = "Ended";
    loan.duration = calculateTotalMonthsDue(loan.date, parsedPaymentDate);
  }

  loan.units = currentLoanUnits;
  loan.lastPaymentDate = parsedPaymentDate;

  return '';
}


/**
 * Calculates due interest and current units for a free loan, considering over-duration charges.
 * This function determines the current 'unit' value of the loan and any 'cash interest'
 * that accrues if the loan extends beyond the borrower's temporary savings/units.
 *
 * @param {object} loan - The loan document.
 * @param {object} user - The borrower's user document, containing temporarySavingsAmount and temporarySavingsUnits.
 * @param {Date} parsedPaymentDate - The date of the current payment/calculation.
 * @returns {object} An object containing currentLoanUnits, excessUnits, cashInterest, and cashUnits.
 */
export async function calculateFreeLoanOverdueMetrics(loan, user, parsedPaymentDate) {

  const totalDaysSinceDeposit = getDaysDifference(user.temporaryInvestment.unitsDate, parsedPaymentDate);

  // Calculate current accumulated units based on elapsed time and principal left
  const currentLoanUnits = getDaysDifference(loan.lastPaymentDate, parsedPaymentDate) * loan.principalLeft + (loan.units || 0);

  // Determine units that exceed the original agreed loan 'value' (amount * duration)
  const excessUnits = Math.max(0, currentLoanUnits - (loan.amount * loan.duration));

  const currentTempSavingsUnits = user.temporaryInvestment.amount * totalDaysSinceDeposit + user.temporaryInvestment.units;
  let cashInterest = 0;
  let cashUnits = 0;

  // If there are excess units AND these exceed the user's available temporary savings units
  if (excessUnits > currentTempSavingsUnits) {

    // Calculate the portion of excess units that must be covered by cash interest
    cashUnits = excessUnits - (user.temporaryInvestment.amount * totalDaysSinceDeposit + user.temporaryInvestment.units);
    
    // Calculate cash interest based on these 'cash units' by dividing the units over 30 to get an amount that has spent 30 days
    cashInterest = ( cashUnits / 30) * CONSTANTS.MONTHLY_LENDING_RATE;
  }

  return { currentLoanUnits, excessUnits, cashInterest, cashUnits, currentTempSavingsUnits };
}

/**
 * Handles the scenario where a free loan payment covers only a portion of the principal.
 * @param {object} loan - The loan document (mutated).
 * @param {number} paymentAmount - The amount paid.
 */
function handlePartialPrincipalPayment(loan, paymentAmount) {
  loan.principalLeft -= paymentAmount;
}

/**
 * Handles the scenario where a free loan has accrued excess units but no cash interest.
 * This implies the excess can be covered by the user's temporary investment units.
 * @param {object} user - The borrower's user document (mutated by service calls).
 * @param {object} loan - The loan document (mutated).
 * @param {number} excessUnits - The units exceeding the original loan value.
 * @param {Date} parsedPaymentDate - The date of the current payment.
 */
async function handleExcessUnitsNoCashInterest(user, loan, currentTempSavingsUnits, excessUnits, parsedPaymentDate) {

  const additionalUnits = currentTempSavingsUnits - excessUnits;

  await UserServiceManager.addTemporaryInvestmentUnits(user._id, additionalUnits);
  await UserServiceManager.setTemporaryInvestmentUnitsDate(user._id, parsedPaymentDate);

  loan.principalLeft = 0;
  loan.status = "Ended";
  loan.duration = calculateTotalMonthsDue(loan.date, parsedPaymentDate); 
}



/**
 * Handles the scenario where a free loan has accrued cash interest due to significant over-duration.
 * @param {object} user - The borrower's user document (mutated by service calls).
 * @param {object} loan - The loan document (mutated).
 * @param {number} paymentAmount - The amount paid.
 * @param {number} cashInterest - The calculated cash interest due.
 * @param {Date} parsedPaymentDate - The date of the current payment.
 */
async function handleCashInterestPayment(user, loan, paymentAmount, cashInterest, parsedPaymentDate) {
  if ((paymentAmount - loan.principalLeft) >= cashInterest) {
    // If payment covers principal and cash interest
    await UserServiceManager.addTemporaryInvestmentUnits(user._id, -user.temporarySavingsUnits);
    await UserServiceManager.setTemporaryInvestmentUnitsDate(user._id, parsedPaymentDate); 

    loan.principalLeft = 0;
    loan.status = "Ended";
    loan.interestAmount = cashInterest; 
    loan.duration = calculateTotalMonthsDue(loan.date, parsedPaymentDate);
  } else {
    throw new ErrorUtil.AppError("Payment amount is insufficient to cover accrued cash interest and principal.", 400);
  }
}
