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
import * as Errors from "./error-util.js"
import Joi from "joi"
import * as Validator from "../../utils/validator-util.js"

// collaborator services
import * as UserServiceManager from "../user-service/service.js";
import * as EmailServiceManager from "../email-service/service.js";
import * as DepositServiceManager from "../deposit-service/service.js";
import * as PointsServiceManager from "../point-service/service.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOAN_TEMPLATES_PATH = path.join(__dirname, 'email-templates'); 

//.......................GENERAL HELPER FUNCTIONS..............................

/**
 * Calculates total number of unpaid/due months considering a grace period.
 * @param {Date} startDate - The start date for calculation.
 * @param {Date} endDate - The end date for calculation.
 * @returns {number} The total number of months due.
 */
function calculateTotalMonthsDue(startDate, endDate) {
  let daysDifference = getDaysDifference(startDate, endDate);
  let months = Math.floor(daysDifference / CONSTANTS.ONE_MONTH_DAYS);
  let daysIntoMonth = daysDifference % CONSTANTS.ONE_MONTH_DAYS;

  // Apply grace period: if days into month is within grace period, don't count it as a full month
  if (daysIntoMonth > 0 && daysIntoMonth <= CONSTANTS.GRACE_PERIOD_DAYS) {
    // If it's just the grace period and no full months, then 1
    months = months === 0 ? 1 : months;
  } else if (daysIntoMonth > CONSTANTS.GRACE_PERIOD_DAYS) {
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

  if (loanDurationMonths <= CONSTANTS.ONE_YEAR_MONTH_THRESHOLD) return 0;
  if (loanDurationMonths <= CONSTANTS.ONE_YEAR_MONTHS) return loanDurationMonths - CONSTANTS.ONE_YEAR_MONTH_THRESHOLD;
  if (loanDurationMonths <= CONSTANTS.TWO_YEAR_MONTH_THRESHOLD) return CONSTANTS.ONE_YEAR_MONTH_THRESHOLD;
  return loanDurationMonths - CONSTANTS.ONE_YEAR_MONTHS;
}

/**
 * Fetches a loan by its ID. Throws an error if not found.
 * @param {string} loanId - The ID of the loan.
 * @returns {Promise<object>} The loan document.
 * @throws {ErrorUtil.AppError} If loan is not found.
 */
export async function getLoanById(loanId) {
  const loan = await DB.query(Loan.findById(loanId));
  Validator.assert(loan, "Loan not found.", { errType: Errors.AppError });
  return loan;
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
  Validator.assert(loan.status === "Pending Approval", "Only 'Pending Approval' loans can be cancelled.", { errType: Errors.AppError });
  const updatedLoanResult = await updateLoanRecord(loanId, { status: "Cancelled" });
  Validator.assert(updatedLoanResult.matchedCount > 0, "Loan request not found or failed to cancel.", { errType: Errors.InternalServerError });
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
  Validator.assert(payment, "Loan payment not found.", { errType: Errors.AppError });
  return payment;
}
/**
 * Initiates a new loan request, dispatching to the appropriate internal function
 * based on the specified loan type.
 *
 * @param {number} amount - The requested loan amount.
 * @param {number} duration - The loan duration in months.
 * @param {Date|string} earliestDate - The earliest possible disbursement date.
 * @param {Date|string} latestDate - The latest possible disbursement date.
 * @param {string} borrowerId - The ID of the borrower.
 * @param {object} currentUser - The user initiating the request.
 * @param {string} loanType - The type of loan to initiate ("Standard" or "Interest-Free").
 * @returns {Promise<object>} A promise that resolves to the created loan document.
 * @throws {ErrorUtil.AppError} If borrower not found, or unsupported loan type, or loan-specific limits exceeded.
 */
export async function initiateLoan(
  amount,
  duration,
  earliestDate,
  latestDate,
  borrowerId,
  currentUser,
  loanType
) {

  Validator.required({ amount, duration, earliestDate, latestDate, borrowerId, currentUser, loanType });
  const borrowerUser = await UserServiceManager.getUserById(borrowerId);
  Validator.assert(borrowerUser, "Borrower not found.", { errType: Errors.AppError });

  // Dispatch based on loanType
  switch (loanType) {
    case "Standard":
      return await initiateStandardLoanRequest(
        amount, duration, earliestDate, latestDate, borrowerUser, currentUser
      );
    case "Interest-Free":
      return await initiateFreeLoanRequest(
        amount, duration, earliestDate, latestDate, borrowerUser, currentUser
      );
    default:
      Validator.assert(false, `Unsupported loan type for initiation: ${loanType}`, { errType: Errors.AppError });
  }
}

/**
 * Approves a pending loan request (either Standard or Interest-Free) and disburses funds.
 * This function acts as a dispatcher, calling the appropriate approval handler based on loan type.
 *
 * @param {string} loanId - The ID of the loan to approve.
 * @param {object} approvedBy - The user approving the loan (from req.user).
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number } for disbursement.
 * @returns {Promise<object>} A promise that resolves to the updated loan document.
 * @throws {ErrorUtil.AppError} If loan not found, not pending, or an unknown loan type.
 */
export async function approveLoan(loanId, approvedBy, sources) {
  Validator.required({ loanId, approvedBy, sources });
  const loan = await getLoanById(loanId);
  const borrowerUser = await UserServiceManager.getUserById(loan.borrower.id);
  Validator.assert(loan, "Loan not found.", { errType: Errors.AppError });
  Validator.assert(loan.status === "Pending Approval",
    `Loan with ID ${loanId} is not in 'Pending Approval' status. Current status: ${loan.status}.`,
    { errType: Errors.AppError }
  );

  // Dispatch based on loan type
  if (loan.type === "Standard") {
    return await approveStandardLoanRequest(loan, approvedBy, sources, borrowerUser);
  } else if (loan.type === "Interest-Free") {
    return await approveFreeLoanRequest(loan, approvedBy, sources, borrowerUser);
  } else {
    Validator.assert(false, `Unsupported loan type for approval: ${loan.type}`, { errType: Errors.AppError });
  }
}

/**
 * Processes a loan payment, dispatching to the appropriate internal function
 * based on the loan type.
 *
 * @param {string} loanId - The ID of the loan being paid.
 * @param {number} paymentAmount - The amount paid.
 * @param {string} cashLocationId - The ID of the cash location where payment was received.
 * @param {object} currentUser - The user recording the payment.
 * @returns {Promise<object>} The updated loan document and a payment message.
 * @throws {ErrorUtil.AppError} If loan or borrower not found, loan status is invalid, or unsupported loan type.
 */
export async function processLoanPayment(loanId, paymentAmount, cashLocationId, currentUser, paymentDate) {
  Validator.required({ loanId, paymentAmount, cashLocationId, currentUser, paymentDate });
  const loan = await getLoanById(loanId);
  Validator.assert(loan, "Loan not found.", { errType: Errors.AppError });
  const borrowerUser = await UserServiceManager.getUserById(loan.borrower.id);
  Validator.assert(borrowerUser, "Borrower user not found for loan payment processing.", { errType: Errors.AppError });
  Validator.assert(loan.status === "Ongoing",
    `Payment cannot be made on a loan with status: '${loan.status}'.`,
    { errType: Errors.AppError }
  );

  switch (loan.type) {
    case "Standard":
      await processStandardLoanPayment(
        loan, borrowerUser, paymentAmount, cashLocationId, currentUser, paymentDate
      );
      break;
    case "Interest-Free":
      await processFreeLoanPayment(
        loan, borrowerUser, paymentAmount, cashLocationId, currentUser, paymentDate
      );
      break;
    default:
      Validator.assert(false, `Unsupported loan type for payment processing: ${loan.type}`, { errType: Errors.AppError });
  }
  return ''; 
}

//..................................STANDARD_LOAN_FUNCTIONS.....................................

//.............INITIATE_STD_LOAN
/**
 * Initiates a new loan request.
 * @param {number} amount - The requested loan amount.
 * @param {number} duration - The loan duration in months.
 * @param {Date|string} earliestDate - The earliest possible disbursement date.
 * @param {Date|string} latestDate - The latest possible disbursement date.
 * @param {string} borrowerUser - The borrower.
 * @param {object} currentUser - The user initiating the request.
 * @returns {Promise<object>} A promise that resolves to the created loan document.
 * @throws {ErrorUtil.AppError} If required information is missing, borrower not found, or loan limit exceeded.
 */
async function initiateStandardLoanRequest(
  amount,
  duration,
  earliestDate,
  latestDate,
  borrowerUser,
  currentUser,
) {

  Validator.required({ amount, duration, earliestDate, latestDate, borrowerUser, currentUser });
  const loanLimit = await calculateStandardLoanLimit(borrowerUser.id); 
  Validator.assert(amount <= loanLimit,
    `The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`,
    { errType: Errors.AppError }
  );

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

  Validator.required({ borrowerId });
  const user = await UserServiceManager.getUserById(borrowerId);
  Validator.assert(user, "Borrower user not found for loan limit calculation.", { errType: Errors.AppError });

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
  Validator.required({ loanAmount, loanDuration, borrowerPoints });
  Validator.assert(loanAmount > 0, "Loan amount must be positive.", { errType: Errors.BadRequestError });
  Validator.assert(loanDuration > 0, "Loan duration must be positive.", { errType: Errors.BadRequestError });
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

  Validator.required({ loanAmount, loanDuration, borrowerPoints, totalRate });
  Validator.assert(loanAmount >= 0, "Loan amount cannot be negative.", { errType: Errors.BadRequestError });
  Validator.assert(loanDuration >= 0, "Loan duration cannot be negative.", { errType: Errors.BadRequestError });
  Validator.assert(borrowerPoints >= 0, "Borrower points cannot be negative.", { errType: Errors.InternalServerError }); // Or BadRequestError if from external input
  Validator.assert(totalRate >= 0, "Total rate cannot be negative.", { errType: Errors.InternalServerError });

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
async function approveStandardLoanRequest(loan, approvedBy, sources) {

  Validator.required({ loan, approvedBy, sources });

  // Deduct funds from cash locations
  await Promise.all(
    sources.map(source =>
      CashLocationServiceManager.addToCashLocation(source.id, -source.amount)
    )
  );

  // Update the loan status and details
  const updatedLoanResult = await updateLoanRecord(loan._id, { 
    status: "Ongoing",
    approvedBy: { id: approvedBy.id, name: approvedBy.fullName },
    date: new Date(),
    sources: sources,
    lastPaymentDate: new Date(),
  });

  await EmailServiceManager.sendEmailWithTemplate({
    sender: "growthspring",
    recipient: borrowerUser.email, 
    subject: "Your Loan Request Was Approved!",
    templateName: "loan-approved.ejs",
    templateData: {
      user_first_name: loan.borrower.name, 
      amount: loan.amount,
      duration: loan.duration,
      installment: loan.installmentAmount
    },
    templatesPath: LOAN_TEMPLATES_PATH
  });

  return updatedLoanResult;
}

//............PROCESS_STD_LOAN_PYMT
/**
 * Processes a loan payment, updating loan status, user points, and sending notifications.
 * This is a high-level orchestration function.
 * @param {string} loan - The loan being paid.
 * @param {number} paymentAmount - The amount paid.
 * @param {string} cashLocationId - The ID of the cash location where payment was received.
 * @param {object} currentUser - The user recording the payment.
 * @returns {Promise<object>} The updated loan document and a payment message.
 */
async function processStandardLoanPayment(loan, borrowerUser, paymentAmount, cashLocationId, currentUser, paymentDate) {

  Validator.required({ loan, borrowerUser, paymentAmount, cashLocationId, currentUser, paymentDate });

  const formattedDate = paymentDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const totalInterestDue = calculateTotalInterestDueAmount(loan, paymentDate);
  const pointsInterestDue = calculatePointsInterestDueAmount(loan, borrowerUser.points, paymentDate);

  // Distribute payment to principal and interest
  const paymentDistribution = calculateStandardLoanPrincipalLeft(paymentAmount, totalInterestDue, loan.principalLeft);

  if (paymentDistribution.excessAmount > 0) { // Keep if due to potential side effects or if threshold check is inside
    Validator.assert(paymentDistribution.excessAmount >= 0, "Excess amount cannot be negative.", { errType: Errors.InternalServerError }); // Defensive
    await handleExcessPayment(paymentDistribution.excessAmount, borrowerUser, cashLocationId, currentUser, paymentDate);
  }

  // Record points consumption and update user balance
  const pointsConsumed = calculatePointsConsumed(pointsInterestDue);

  if (pointsConsumed > 0) { // Keep if due to potential side effects
    Validator.assert(pointsConsumed > 0, "Points consumed must be positive to redeem.", { errType: Errors.InternalServerError }); // Defensive
    await PointsServiceManager.redeemPoints(borrowerUser.id, pointsConsumed, 'Loan Interest', '');
    await updateUserPointsBalance(borrowerUser.id, -pointsConsumed);
  }

  // Update loan properties based on payment distribution and points consumed
  const pendingDebt = await updateLoanAfterPayment(loan, paymentDistribution, (loan.pointsSpent || 0) + pointsConsumed, paymentDate);

  // Add the current payment to the loan's payments array
  loan.payments.push({
    amount: paymentAmount,
    date: paymentDate,
    location: cashLocationId,
    recordedBy: { id: currentUser.id, name: currentUser.fullName }
  });

  // Add payment to cash location (inflow)
  await CashLocationServiceManager.addToCashLocation(cashLocationId, paymentAmount);

  // Persist the updated loan document
  const updatedLoanRecordResult = await DB.query(loan.save());

  // Send notification
  let template = pendingDebt > 0 ? "loan-payment-confirmation.ejs" : "loan-cleared.ejs"; // Logical Fix: add .ejs to "loan-cleared" if it's a template file

  await EmailServiceManager.sendEmailWithTemplate({
    sender: "growthspring",
    recipient: borrowerUser.email,
    subject: "Your Loan Payment Was Successful!",
    templateName: template,
    templateData: {
      amount_paid: paymentAmount,
      date: formattedDate,
      outstanding_debt: pendingDebt
    },
    templatesPath: LOAN_TEMPLATES_PATH
  });

  return '';
}

/**
 * Determines the payment distribution (how much goes to interest, how much to principal).
 * @param {number} paymentAmount - The total amount paid.
 * @param {number} totalInterestDue - The total calculated interest due.
 * @param {number} principalLeft - The remaining principal.
 * @returns {object} { interestPaid: number, principalPaid: number, excessAmount: number }
 */
export function calculateStandardLoanPrincipalLeft(paymentAmount, totalInterestDue, principalLeft) {

  Validator.required({ paymentAmount, totalInterestDue, principalLeft });
  Validator.assert(paymentAmount >= 0, "Payment amount cannot be negative.", { errType: Errors.BadRequestError });
  Validator.assert(totalInterestDue >= 0, "Total interest due cannot be negative.", { errType: Errors.InternalServerError });
  Validator.assert(principalLeft >= 0, "Principal left cannot be negative.", { errType: Errors.InternalServerError });

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
    principalPaid = (paymentAmount - totalInterestDue); 
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

  Validator.required({ loan, dueDate, availablePoints });

  const totalInterestDue = calculateTotalInterestDueAmount(loan, dueDate);
  const pointsInterestDue = calculatePointsInterestDueAmount(loan, availablePoints, dueDate);

  return Math.max(0, totalInterestDue - pointsInterestDue);

}

/**
 * Calculates the number of points consumed if the interest is paid with points.
 * @param {number} pointsInterestDueAmount - The interest amount being paid by points.
 * @returns {number} The number of points required.
 */
export function calculatePointsConsumed(pointsInterestDueAmount) {

  Validator.required({ pointsInterestDueAmount });
  Validator.assert(pointsInterestDueAmount >= 0, "Points interest due amount cannot be negative.", { errType: Errors.InternalServerError });
  Validator.assert(CONSTANTS.POINTS_VALUE_PER_UNIT > 0, "POINTS_VALUE_PER_UNIT must be positive.", { errType: Errors.InternalServerError }); // Defensive check

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
  Validator.required({ loan, availablePoints, dueDate });

  const totalInterestDue = calculateTotalInterestDueAmount(loan, dueDate);
  const totalMonthsDue = calculateTotalMonthsDue(loan.lastPaymentDate, dueDate);
  const pointMonthsDue = calculatePointsMonthsDue(loan.date, loan.lastPaymentDate, dueDate);

  let pointsInterestDue = 0;
  if (totalMonthsDue > 0) {
    pointsInterestDue = totalInterestDue * (pointMonthsDue / totalMonthsDue);
  } else {
    pointsInterestDue = 0;
  }
  pointsInterestDue = Math.min(pointsInterestDue, availablePoints * CONSTANTS.POINTS_VALUE_PER_UNIT);

  return Math.max(0, pointsInterestDue);
}

/**
 * Calculates the total unpaid/due interest on a loan.
 * @param {object} loan - The loan document.
 * @param {Date} dueDate - The date up to which interest is calculated.
 * @returns {number} The total interest due.
 */
function calculateTotalInterestDueAmount(loan, dueDate) {
  Validator.required({ loan, dueDate });

  const totalMonthsDue = calculateTotalMonthsDue(loan.lastPaymentDate, dueDate);
  const MONTHLY_INTEREST_RATE = CONSTANTS.MONTHLY_LENDING_RATE / 100;

  Validator.assert(MONTHLY_INTEREST_RATE >= 0, "Monthly interest rate must be non-negative.", { errType: Errors.InternalServerError });
  Validator.assert(loan.principalLeft >= 0, "Loan principal left cannot be negative.", { errType: Errors.InternalServerError });

  let totalAmount = loan.principalLeft * Math.pow((1 + MONTHLY_INTEREST_RATE), totalMonthsDue);
  return Math.max(0, totalAmount - loan.principalLeft);

}

/**
 * Calculates number of unpaid/due months whose interest can be cleared with points.
 * @param {Date} loanStartDate - The original loan start date.
 * @param {Date} lastPaymentDate - The date of the last payment.
 * @param {Date} currentDueDate - The current date for calculating due months.
 * @returns {number} The number of point-eligible months due.
 */
function calculatePointsMonthsDue(loanStartDate, lastPaymentDate, currentDueDate) {
  Validator.required({ loanStartDate, lastPaymentDate, currentDueDate });

  const totalPointMonthsAccrued = calculatePointMonthsAccrued(loanStartDate, currentDueDate);
  const clearedPointMonths = calculatePointMonthsAccrued(loanStartDate, lastPaymentDate);
  return Math.max(0, totalPointMonthsAccrued - clearedPointMonths);
}

/**
 * Adjusts a user's points balance.
 * @param {string} userId - ID of the user.
 * @param {number} pointsChange - Amount to change (positive for add, negative for deduct).
 */
export async function updateUserPointsBalance(userId, pointsChange) {
  Validator.required({ userId, pointsChange });

  if (pointsChange !== 0) {
    await UserServiceManager.updateUser(userId, { $inc: { "points": pointsChange } });
  }
}

/**
 * Updates the loan document based on payment distribution.
 * @param {object} loan - The loan document (to be mutated).
 * @param {object} paymentDistribution - Result from calculateStandardLoanPrincipalLeft.
 * @param {number} pointsSpentOnLoan - The total points spent on this loan so far.
 */
export function updateLoanAfterPayment(loan, paymentDistribution, pointsSpentOnLoan, paymentDate) {
  Validator.required({ loan, paymentDistribution, pointsSpentOnLoan, paymentDate });
  const { interestPaid, principalPaid } = paymentDistribution;
  Validator.assert(interestPaid >= 0, "Interest paid cannot be negative.", { errType: Errors.InternalServerError });
  Validator.assert(principalPaid >= 0, "Principal paid cannot be negative.", { errType: Errors.InternalServerError });

  loan.principalLeft -= principalPaid;
  loan.interestAmount += interestPaid; 

  // If loan is fully paid
  if (loan.principalLeft <= 0 && loan.interestAmount <= 0) {
    loan.principalLeft = 0;
    loan.status = "Ended";
    loan.duration = calculateTotalMonthsDue(loan.date, paymentDate);
    loan.pointsSpent = pointsSpentOnLoan;
  }
  loan.lastPaymentDate = paymentDate;
  return loan.principalLeft;
}

/**
 * Handles creation of deposit for excess loan payments.
 * @param {number} excessAmount - The amount of excess payment.
 * @param {object} borrowerUser - The borrower's user document.
 * @param {string} cashLocationId - The ID of the cash location.
 * @param {object} currentUser - The user recording the transaction.
 * @returns {Promise<string>} A message if a deposit was created.
 */
async function handleExcessPayment(excessAmount, borrowerUser, cashLocationId, currentUser, paymentDate) {
  Validator.required({ excessAmount, borrowerUser, cashLocationId, currentUser, paymentDate });
  Validator.assert(excessAmount >= 0, "Excess amount must be non-negative.", { errType: Errors.InternalServerError });
  Validator.assert(CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD !== undefined && CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD !== null,
    "CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD is not defined.", { errType: Errors.InternalServerError });

  if (excessAmount >= CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD) {
    await DepositServiceManager.createDeposit({
      depositor: borrowerUser.id,
      amount: excessAmount,
      type: "club saving",
      cashLocation: { _id: cashLocationId, name: 'Automatically Determined' },
      source: "Excess Loan Payment",
      date: paymentDate,
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
 * @param {string} borrowerUser - The borrower.
 * @param {object} currentUser - The user initiating the request.
 * @returns {Promise<object>} A promise that resolves to the created loan document.
 * @throws {ErrorUtil.AppError} If required information is missing, borrower not found, or loan limit exceeded.
 */
async function initiateFreeLoanRequest(
  amount,
  duration,
  earliestDate,
  latestDate,
  borrowerUser,
  currentUser,
) {

  Validator.required({ amount, duration, earliestDate, latestDate, borrowerUser, currentUser });
 
  const { loanLimit, loanPeriodLimit } = calculateFreeLoanEligibility(borrowerUser, amount, duration);

  Validator.assert(amount <= loanLimit,
    `The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`,
    { errType: Errors.AppError }
  );

  Validator.assert(duration <= loanPeriodLimit,
    `The Loan Period of ${Math.round(loanPeriodLimit).toLocaleString('en-US')} has been exceeded!`,
    { errType: Errors.AppError }
  );

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
 * @param {number} requestedPeriod - The requested loan period (used for loan limit calculation).
 * @returns {object} An object containing loanLimit and loanPeriodLimit.
 */
export function calculateFreeLoanEligibility(user, requestedAmount, requestedPeriod) {

  Validator.required({ user, requestedAmount, requestedPeriod });
  Validator.assert(user.temporarySavingsAmount !== undefined && user.temporarySavingsUnits !== undefined,
    "User temporary savings data is incomplete.", { errType: Errors.InternalServerError });

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
 * @param {string} loan - The loan to approve.
 * @param {object} approvedBy - The user approving the loan.
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number } for disbursement.
 * @returns {Promise<object>} A promise that resolves to the updated loan document.
 * @throws {ErrorUtil.AppError} If loan not found, not pending, or disbursement fails.
 */
async function approveFreeLoanRequest(loan, approvedBy, sources, borrowerUser) {
 
  Validator.required({ loan, approvedBy, sources });

  await Promise.all(
    sources.map(source =>
      CashLocationServiceManager.addToCashLocation(source.id, -source.amount)
    )
  );

  await UserServiceManager.addTemporaryInvestmentUnits(loan.borrower.id, -loan.units);

  const updatedLoanResult = await updateLoanRecord(loan._id, {
    status: "Ongoing",
    approvedBy: { id: approvedBy.id, name: approvedBy.fullName },
    date: new Date(),
    units: 0, 
    sources: sources,
    lastPaymentDate: new Date(),
  });

  await EmailServiceManager.sendEmailWithTemplate({
    sender: "growthspring",
    recipient: borrowerUser.email, 
    subject: "Your Loan Request Was Approved!",
    templateName: "loan-approved.ejs",
    templateData: {
      user_first_name: loan.borrower.name, 
      amount: loan.amount,
      duration: loan.duration,
      installment: loan.installmentAmount
    },
    templatesPath: LOAN_TEMPLATES_PATH
  });

  return updatedLoanResult;
}

/**
 * Records a new payment for a Free loan.
 * @param {string} loan - The loan.
 * @param {number} paymentAmount - The amount of the payment.
 * @param {Date|string} paymentDate - The date of the payment.
 * @param {string} cashLocationId - The ID of the cash location where the payment was made.
 * @param {object} currentUser - The user recording the payment.
 * @returns {Promise<object>} An object containing the new loan status and a message.
 * @throws {ErrorUtil.AppError} If loan not found, invalid payment date, or not an ongoing loan.
 */
async function processFreeLoanPayment(
  loan,
  borrowerUser,
  paymentAmount,
  paymentDate, 
  cashLocationId,
  currentUser
) {

  Validator.required({ loan, borrowerUser, paymentAmount, paymentDate, cashLocationId, currentUser });

  const parsedPaymentDate = new Date(paymentDate);
  const formattedDate = parsedPaymentDate.toLocaleDateString("en-US", { // Logical Fix: use parsedPaymentDate here
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  Validator.assert(new Date(loan.date).getTime() <= parsedPaymentDate.getTime(),
    "Payment date cannot be before the loan initiation date!",
    { errType: Errors.AppError }
  );

  await calculateFreeLoanPrincipleLeft(loan, borrowerUser, paymentAmount, parsedPaymentDate); // Logical Fix: borrowerUser was missing from args

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

  await updateLoanRecord(loan._id, updatedLoanData);

  let template = loan.principalLeft > 0 ? "loan-payment-confirmation.ejs" : "loan-cleared.ejs"; 

  await EmailServiceManager.sendEmailWithTemplate({
    sender: "growthspring",
    recipient: borrowerUser.email,
    subject: "Your Loan Payment Was Successful!",
    templateName: template,
    templateData: {
      amount_paid: paymentAmount,
      date: formattedDate,
      outstanding_debt: loan.principalLeft
    },
    templatesPath: LOAN_TEMPLATES_PATH
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

  Validator.required({ user, loan, paymentAmount, parsedPaymentDate });

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

  loan.units = currentLoanUnits; // Logical Issue: This updates `loan.units` with `currentLoanUnits` calculated. Be sure this is the intended behavior and doesn't conflict with how `loan.units` is used (e.g., in `approveFreeLoanRequest` where it's set to 0).
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
async function calculateFreeLoanOverdueMetrics(loan, user, parsedPaymentDate) {

  Validator.required({ loan, user, parsedPaymentDate });
 
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
    cashInterest = (cashUnits / 30) * CONSTANTS.MONTHLY_LENDING_RATE;
  }

  return { currentLoanUnits, excessUnits, cashInterest, cashUnits, currentTempSavingsUnits };
}

/**
 * Handles the scenario where a free loan payment covers only a portion of the principal.
 * @param {object} loan - The loan document (mutated).
 * @param {number} paymentAmount - The amount paid.
 */
function handlePartialPrincipalPayment(loan, paymentAmount) {
  Validator.required({ loan, paymentAmount });
  Validator.assert(paymentAmount >= 0, "Payment amount cannot be negative.", { errType: Errors.BadRequestError });
  loan.principalLeft -= paymentAmount;
}

/**
 * Handles the scenario where a free loan has accrued excess units but no cash interest.
 * This implies the excess can be covered by the user's temporary investment units.
 * @param {object} user - The borrower's user document (mutated by service calls).
 * @param {object} loan - The loan document (mutated).
 * @param {number} currentTempSavingsUnits - The borrower's current temporary savings units.
 * @param {number} excessUnits - The units exceeding the original loan value.
 * @param {Date} parsedPaymentDate - The date of the current payment.
 */
async function handleExcessUnitsNoCashInterest(user, loan, currentTempSavingsUnits, excessUnits, parsedPaymentDate) {

  Validator.required({ user, loan, currentTempSavingsUnits, excessUnits, parsedPaymentDate });
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
  Validator.required({ user, loan, paymentAmount, cashInterest, parsedPaymentDate });
  Validator.assert(paymentAmount >= 0, "Payment amount cannot be negative.", { errType: Errors.BadRequestError });
  Validator.assert(cashInterest >= 0, "Cash interest cannot be negative.", { errType: Errors.InternalServerError });

  Validator.assert((paymentAmount - loan.principalLeft) >= cashInterest,
    "Payment amount is insufficient to cover accrued cash interest and principal.",
    { errType: Errors.AppError }
  );

  // If payment covers principal and cash interest
  await UserServiceManager.addTemporaryInvestmentUnits(user._id, -user.temporarySavingsUnits);
  await UserServiceManager.setTemporaryInvestmentUnitsDate(user._id, parsedPaymentDate);

  loan.principalLeft = 0;
  loan.status = "Ended";
  loan.interestAmount = cashInterest;
  loan.duration = calculateTotalMonthsDue(loan.date, parsedPaymentDate);
}