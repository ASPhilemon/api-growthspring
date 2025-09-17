//GENERAL_REQUESTS
//STANDARD_LOAN_FUNCTIONS
//LOAN_LIMIT_MULTIPLIER
//STD_LOAN_LIMIT
//INITIATE_STD_LOAN
//APPROVE_STD_LOAN
//PROCESS_STD_LOAN_PYMT
//TEMPORARY_LOANS



// model
import { Loan } from "./models.js";
import mongoose from "mongoose"; 

import { v4 as uuidv4 } from 'uuid';

// util
import * as DB from "../../utils/db-util.js";
import * as ErrorUtil from "../../utils/error-util.js";
import { getDaysDifference } from "../../utils/date-util.js";

import CONSTANTS from '../../src/config/constants.js'; 
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator-util.js"

// collaborator services
import * as UserServiceManager from "../user-service/service.js";
import * as EmailServiceManager from "../email-service/service.js";
import * as DepositServiceManager from "../deposit-service/service.js";
import * as PointsServiceManager from "../point-service/service.js";
import * as CashLocationServiceManager from '../cash-location-service/service.js';

const LOAN_TEMPLATES_PATH = "./email-templates.js"; 


//....................................GENERAL_REQUESTS.....................................

/**
 * Retrieves a list of loans based on filter, sort, and pagination criteria.
 * @param {object} params - Object containing filter, sort, and pagination.
 * @returns {Promise<Array>} A promise that resolves to an array of loan documents.
 */
export async function getLoans({ userId, year, status, sort, pagination, type }) {
  //console.log(userId, year, status)
  return await Loan.getFilteredLoans({ userId, year, status, sort, pagination, type }); 
}

/**
 * Fetches a loan by its ID. Throws an error if not found.
 * @param {string} loanId - The ID of the loan.
 * @returns {Promise<object>} The loan document.
 * @throws {ErrorUtil.AppError} If loan is not found.
 */
export async function getLoanById(loanId) {
  const loan = await DB.query(Loan.findById(loanId));
  Validator.assert(loan, "Loan not found.", Errors.AppError);
  return loan;
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
  Validator.assert(payment, "Loan payment not found.", Errors.AppError);
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
  date,
  borrowerId,
  currentUser,
  loanType
) {

  Validator.required({ amount, duration, date, borrowerId, currentUser, loanType });
  const borrowerUser = await UserServiceManager.getUserById(borrowerId);
  Validator.assert(borrowerUser, "Borrower not found.", Errors.AppError);

  // Dispatch based on loanType
  switch (loanType) {
    case "Standard":
      return await initiateStandardLoanRequest(
        amount, duration, earliestDate = date, latestDate = date, borrowerUser, currentUser, 
      );
    case "Interest-Free":
      return await initiateFreeLoanRequest(
        amount, duration, earliestDate =cdate, latestDatec= date, borrowerUser, currentUser, 
      );
    default:
      Validator.assert(false, `Unsupported loan type for initiation: ${loanType}`, Errors.AppError );
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
  Validator.assert(loan, "Loan not found.", Errors.AppError);
  Validator.assert(loan.status === "Pending Approval",
    `Loan with ID ${loanId} is not in 'Pending Approval' status. Current status: ${loan.status}.`,
    Errors.AppError 
  );

  // Dispatch based on loan type
  if (loan.type === "Standard") {
    return await approveStandardLoanRequest(loan, approvedBy, sources, borrowerUser);
  } else if (loan.type === "Interest-Free") {
    return await approveFreeLoanRequest(loan, approvedBy, sources, borrowerUser);
  } else {
    Validator.assert(false, `Unsupported loan type for approval: ${loan.type}`, Errors.AppError );
  }
}

/**
 * Cancels a pending loan request.
 * @param {string} loanId - The ID of the loan request to cancel.
 * @returns {Promise<object>} A success message if cancelled.
 * @throws {ErrorUtil.AppError} If loan not found or not in pending status.
 */
export async function cancelLoanRequest(loanId) {
  const loan = await getLoanById(loanId);
  Validator.assert(loan.status === "Pending Approval", "Only 'Pending Approval' loans can be cancelled.", Errors.AppError);
  
  const updatedLoanResult = await Loan.updateOne({ _id: loanId }, { status: "Cancelled" });

  Validator.assert(updatedLoanResult.matchedCount > 0, "Loan request not found or failed to cancel.", Errors.InternalServerError);
  return { msg: 'Loan request cancelled successfully.' };
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
  Validator.assert(loan, "Loan not found.", Errors.AppError);
  const borrowerUser = await UserServiceManager.getUserById(loan.borrower.id);
  Validator.assert(borrowerUser, "Borrower user not found for loan payment processing.", Errors.AppError);
  Validator.assert(loan.status === "Ongoing",
    `Payment cannot be made on a loan with status: '${loan.status}'.`,
    Errors.AppError 
  );

  switch (loan.type) {
    case "Standard":
      await processStandardLoanPayment(
        loan, borrowerUser, paymentAmount, cashLocationId, currentUser, paymentDate, 
      );
      break;
    case "Interest-Free":
      await processFreeLoanPayment(
        loan, borrowerUser, paymentAmount, cashLocationId, currentUser, paymentDate, 
      );
      break;
    default:
      Validator.assert(false, `Unsupported loan type for payment processing: ${loan.type}`, Errors.AppError );
  }
  return ''; 
}

//.......................GENERAL_HELPER_FUNCTIONS..............................

/**
 * Calculates total number of unpaid/due months considering a grace period.
 * @param {Date} startDate - The start date for calculation.
 * @param {Date} endDate - The end date for calculation.
 * @returns {number} The total number of months due.
 */
function calculateTotalMonthsDue(startDate, endDate) {
  let daysDifference = Math.max(0, getDaysDifference(startDate, endDate));
  let months = Math.floor(daysDifference / CONSTANTS.ONE_MONTH_DAYS);
  let daysIntoMonth = daysDifference % CONSTANTS.ONE_MONTH_DAYS;

  // Apply grace period: if days into month is within grace period, don't count it as a full month
  if (daysIntoMonth <= CONSTANTS.GRACE_PERIOD_DAYS) {
    months = months;
  } else if (daysIntoMonth > CONSTANTS.GRACE_PERIOD_DAYS) {
    // If days into month exceeds grace period, count it as an additional month
    months += 1;
  }
  return months;
}

/**
 * Calculates the number of months whose interest can be cleared with points given a loan duration.
 * This is about the *total* point-eligible months based on the loan's life, where for each year,
 * only the months after a certain threshold are counted.
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

  if (loanDurationMonths <= 0) {
      return 0;
  }

  const fullYears = Math.floor(loanDurationMonths / 12);
  const remainingMonths = loanDurationMonths % 12;

  const pointMonthsPerYear = 12 - CONSTANTS.ONE_YEAR_MONTH_THRESHOLD;

  const pointsFromFullYears = fullYears * pointMonthsPerYear;
  const pointsFromRemainder = Math.max(0, remainingMonths - CONSTANTS.ONE_YEAR_MONTH_THRESHOLD);

  return pointsFromFullYears + pointsFromRemainder;
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
    initiatedBy: { id: params.currentUser._id, name: params.currentUser.fullName },
    approvedBy: {},
    worthAtLoan: params.borrowerUser.permanentInvestment.amount,
    amount: params.amount,
    date: today,
    borrower: { id: params.borrowerUser._id, name: params.borrowerUser.fullName },
    pointsSpent: params.pointsSpent,
    discount: 0,
    pointsWorthBought: 0,
    rateAfterDiscount: params.rateAfterDiscount,
    interestAmount: params.interestAmount,
    principalLeft: params.amount,
    lastPaymentDate: today,
  };

  const createdLoan = await DB.query(Loan.create(newLoan));
  return createdLoan;
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
    Errors.AppError 
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
    interestAmount: 0,
    installmentAmount: installmentAmount,
    pointsSpent: pointsSpent,
    rateAfterDiscount: totalRate
  });

  return createdLoan;
}
//.....................HELPER_FUNCTIONS_FOR_INITIATING_STANDARD_LOANS...................................

/**
 * Fetches user data and calculates their available standard loan limit.
 * @param {string} borrowerId - The ID of the borrower.
 * @returns {Promise<number>} The calculated loan limit.
 */
export async function calculateStandardLoanLimit(borrowerId) {

  const user = await UserServiceManager.getUserById(borrowerId);
  Validator.assert(user, "Borrower user not found for loan limit calculation.", Errors.AppError);

  const ongoingDebts = await DB.query(Loan.find({
      "borrower.id": new mongoose.Types.ObjectId(borrowerId),
      status: "Ongoing",
      type: "Standard"
  }));

  const today = new Date();
  const dateAYearAgo = new Date(today.getTime() - (365 * 24 * 60 * 60 * 1000));
  const userId = borrowerId;
  const periodEnd = today;
  const periodStart = dateAYearAgo;

  const interestPaidInLastYear = await getAggregatedLoanInterestByPeriod({
      userId,
      periodStart,
      periodEnd
  });
  
  const {loanMultiplier, loanLimit} = _calculateLimit(user, ongoingDebts, interestPaidInLastYear)

  return {loanMultiplier, loanLimit, interestPaidInLastYear} ;
}

/**
 * Calculates the loan limit based on pre-fetched user data.
 * This is a pure function for easier testing.
 * @param {object} user - The borrower's user document.
 * @param {Array<object>} ongoingDebts - An array of the user's ongoing loans.
 * @param {number} interestPaidInLastYear - The total interest paid by the user in the last year.
 * @returns {number} The calculated loan limit.
 */
export function _calculateLimit(user, ongoingDebts, interestPaidInLastYear) {
  
  const totalOngoingPrincipal = ongoingDebts.reduce((total, loan) => total + loan.principalLeft, 0);
  const loanMultiplier = getLimitMultiplier(interestPaidInLastYear, user.permanentInvestment.amount);
  const loanLimit = (user.permanentInvestment.amount || 0) * loanMultiplier - totalOngoingPrincipal
  return {loanMultiplier, loanLimit};
}


//...................................FUNCTIONS_TO_DETERMINE_INTEREST_CHARGED_IN_A_SPECIFIC_PERIOD..........
/**
 * Aggregates interest from loans for specified members within a given period,
 * categorizing them based on their start/effective-end dates.
 *
 * @param {object} options - Options object.
 * @param {string|string[]} options.memberIds - Single member id string or array of member id strings.
 * @param {Date} options.periodStart - The start date of the period for interest aggregation.
 * @param {Date} options.periodEnd - The end date of the period for interest aggregation.
 * @returns {Promise<number>} The total aggregated interest for all categorized loans.
 * @throws {ErrorUtil.AppError} If validation fails or database operations encounter issues.
 */
export async function getAggregatedLoanInterestByPeriod({ userId, periodStart, periodEnd }) {
  // Validate input arguments
  Validator.required({ userId, periodStart, periodEnd });
  const type = "Standard";

  const allLoans = await getLoans({ userId, type }) || [];

  // Initialize arrays for each category
  const category1Loans = []; // Started & Ended within [periodStart, periodEnd]
  const category2Loans = []; // Started < periodStart, Ended < periodEnd
  const category3Loans = []; // Started > periodStart, Ended > periodEnd (or Ongoing)
  const category4Loans = []; // Started < periodStart, Ended > periodEnd (or Ongoing)

  // 2. Categorize each loan based on its start date and calculated effective end date
  for (const loan of allLoans) {
    const loanStartDate = new Date(loan.date);
    let effectiveLoanEndDate;

    try {
      effectiveLoanEndDate = getLoanEffectiveEndDate(loan, periodEnd).effectiveLoanEndDate;
    } catch (error) {
      console.warn(`Skipping loan ${loan._id} for member ${loan.borrower?.fullName || 'N/A'} due to error in effective end date calculation: ${error.message}`);
      continue; 
    }

    const isOngoing = loan.status === "Ongoing";

    // Use the calculated `effectiveLoanEndDate` for categorization logic
    if (loanStartDate >= periodStart && effectiveLoanEndDate <= periodEnd && !isOngoing) {
      // Category 1: Loan's entire effective duration falls within the period
      category1Loans.push(loan);
    } else if (loanStartDate < periodStart && effectiveLoanEndDate < periodEnd && !isOngoing) {
      // Category 2: Loan started before the period and ended before the period
      category2Loans.push(loan);
    } else if (loanStartDate > periodStart && effectiveLoanEndDate > periodEnd) {
      // Category 3: Loan started after the period start and effectively ends after period end
      // (This includes loans that are truly ongoing beyond periodEnd, or ended after periodEnd)
      category3Loans.push(loan);
    } else if (loanStartDate < periodStart && effectiveLoanEndDate > periodEnd) {
      // Category 4: Loan started before the period start and effectively ends after period end (spans the period)
      // (This includes loans that are truly ongoing beyond periodEnd, or ended after periodEnd)
      category4Loans.push(loan);
    }
  }

  // 3. Calculate interest for each category using respective helper functions
  const interestCat1 = await getInterestForLoansStartedAndEndedWithinPeriod(category1Loans);
  const interestCat2 = await getProroratedInterestForStartedBeforePeriodEndedBeforePeriod(category2Loans, periodStart, periodEnd);
  const interestCat3 = await getProroratedInterestForStartedAfterPeriodEndedAfterPeriod(category3Loans, periodEnd, periodEnd);
  const interestCat4 = await getInterestForLoansSpanningPeriod(category4Loans, periodStart, periodEnd, periodEnd);

  // 4. Sum up all calculated interests
  const totalAggregatedInterest = interestCat1 + interestCat2 + interestCat3 + interestCat4;

  return totalAggregatedInterest;
}

// Helper to determine the "newDate" which is the actual end date of the loan
function getLoanEffectiveEndDate(loan) {
  let projectedLoanUnits;
  const MS_PER_DAY = 24 * 60 * 60 * 1000; // Milliseconds in a day

  if (loan.status === "Ongoing") {
    const daysSinceLastPayment = getDaysDifference(new Date(loan.lastPaymentDate), new Date());
    const effectivePrincipalLeft = Math.max(0, loan.principalLeft || 0); 

    projectedLoanUnits = (loan.units || 0) + (daysSinceLastPayment * effectivePrincipalLeft);

  } else {
    projectedLoanUnits = (loan.units || 0);
  }
  
  const actualDurationDays = projectedLoanUnits / loan.amount;

  // Calculate the effective end date by adding the duration to the loan start date
  const loanStartDateMs = new Date(loan.date).getTime();
  const effectiveEndDateMs = loanStartDateMs + actualDurationDays * MS_PER_DAY;
  const effectiveLoanEndDate = new Date(effectiveEndDateMs);

  return { effectiveLoanEndDate, actualDurationDays };
}

/**
 * Categorizes 1: Loans that started AND ended within the given period.
 * Interest: Directly from `loan.interestAmountPaid`.
 *
 * @param {Array<object>} loans - Array of loan documents for this category.
 * @returns {number} The sum of `interestAmountPaid` for these loans.
 */
async function getInterestForLoansStartedAndEndedWithinPeriod(loans) {
  let totalInterest = 0;
  for (const loan of loans) {
    totalInterest += (loan.interestAmount || 0);
  }
  return totalInterest;
}

/**
 * Categorizes 2: Loans that started BEFORE `periodStart` and ended BEFORE `periodEnd`.
 * Interest: Prorated based on days exceeding `periodStart`.
 * Formula: (days (loan.effectiveEndDate - periodStart)) / (effective total duration) * loan.interestAmountPaid.
 * Result is 0 if `loan.effectiveEndDate` is before `periodStart`.
 *
 * @param {Array<object>} loans - Array of loan documents for this category.
 * @param {Date} periodStart - The start of the overall period.
 * @param {Date} currentCalculationDate - The date up to which units should be projected for effective end date.
 * @returns {number} The sum of prorated interest.
 */
async function getProroratedInterestForStartedBeforePeriodEndedBeforePeriod(loans, periodStart, currentCalculationDate) {
  let totalInterest = 0;
  for (const loan of loans) {
    const {effectiveLoanEndDate, actualDurationDays } = getLoanEffectiveEndDate(loan, currentCalculationDate);

    // Get days 'newDate' (effectiveLoanEndDate) exceeds periodStart. Will be 0 if effectiveLoanEndDate <= periodStart.
    const daysNewDateExceedsPeriodStart = getDaysDifference(periodStart, effectiveLoanEndDate);

    if (actualDurationDays > 0) {
      const prorationFactor = daysNewDateExceedsPeriodStart / actualDurationDays;
      totalInterest += prorationFactor * (loan.interestAmount || 0);
    }
  }
  return totalInterest;
}


/**
 * Categorizes 3: Fetches data for loans that started AFTER `periodStart` and ended AFTER `periodEnd` (including ongoing)
 * and calculates their prorated interest.
 * @param {Array<object>} loans - Array of loan documents for this category.
 * @param {Date} periodEnd - The end of the overall period.
 * @param {Date} currentCalculationDate - The date up to which to calculate the loan duration.
 * @returns {Promise<number>} The sum of prorated interest.
 */
async function getProroratedInterestForStartedAfterPeriodEndedAfterPeriod(loans, periodEnd, currentCalculationDate) {
  let totalInterest = 0;
  for (const loan of loans) {
      // --- Step 1: Fetch all necessary data ---
      const { effectiveLoanEndDate, actualDurationDays } = getLoanEffectiveEndDate(loan, currentCalculationDate);
      const borrowerId = loan.borrower.id ? loan.borrower.id : loan.borrower._id;
      const borrowerUser = await UserServiceManager.getUserById(borrowerId);
      const daysNewDateExceedsPeriodEnd = getDaysDifference(periodEnd, effectiveLoanEndDate);
      //console.log(loans)
      const baseInterest = loan.status === 'Ended' 
          ? loan.interestAmount 
          : calculateCashInterestDueAmount(loan, periodEnd, borrowerUser.points).totalInterest;

      // --- Step 2: Call the pure calculation function with the fetched data ---
      totalInterest += _calculateProratedInterestForCat3(actualDurationDays, daysNewDateExceedsPeriodEnd, baseInterest);
  }
  return totalInterest;
}

/**
 * Calculates the prorated interest for a single loan that started after a period and ended after it.
 * This is a pure function for easier testing.
 * @param {number} actualDurationDays - The loan's total effective duration in days.
 * @param {number} daysNewDateExceedsPeriodEnd - The number of days the loan's effective end date is past the period end.
 * @param {number} baseInterest - The total interest amount to be prorated.
 * @returns {number} The prorated interest amount.
 */
export function _calculateProratedInterestForCat3(actualDurationDays, daysNewDateExceedsPeriodEnd, baseInterest) {
  if (actualDurationDays <= 0) {
      return 0;
  }
  const prorationFactor = (actualDurationDays - daysNewDateExceedsPeriodEnd) / actualDurationDays;
  return prorationFactor * baseInterest;
}

/**
 * Categorizes 4: Fetches data for loans that started BEFORE a period and ended AFTER it (spanning the period)
 * and calculates their prorated interest.
 * @param {Array<object>} loans - Array of loan documents for this category.
 * @param {Date} periodStart - The start of the overall period.
 * @param {Date} periodEnd - The end of the overall period.
 * @param {Date} currentCalculationDate - The date up to which to calculate the loan duration.
 * @returns {Promise<number>} The sum of prorated interest.
 */
async function getInterestForLoansSpanningPeriod(loans, periodStart, periodEnd, currentCalculationDate) {
  let totalInterest = 0;
  for (const loan of loans) {
      // --- Step 1: Fetch all necessary data ---
      const { actualDurationDays } = getLoanEffectiveEndDate(loan, currentCalculationDate);
      const borrowerUser = await UserServiceManager.getUserById(loan.borrower.id);
      const daysWithinPeriod = getDaysDifference(periodStart, periodEnd);

      const baseInterest = loan.status === 'Ended'
          ? loan.interestAmount
          : calculateCashInterestDueAmount(loan, periodEnd, borrowerUser.points).totalInterest;

      // --- Step 2: Call the pure calculation function with the fetched data ---
      totalInterest += _calculateProratedInterestForCat4(actualDurationDays, daysWithinPeriod, baseInterest);
  }
  return totalInterest;
}

/**
 * Calculates the prorated interest for a single loan that spans a given period.
 * This is a pure function for easier testing.
 * @param {number} actualDurationDays - The loan's total effective duration in days.
 * @param {number} daysWithinPeriod - The number of days the loan was active within the period.
 * @param {number} baseInterest - The total interest amount to be prorated.
 * @returns {number} The prorated interest amount.
 */
export function _calculateProratedInterestForCat4(actualDurationDays, daysWithinPeriod, baseInterest) {
  if (actualDurationDays <= 0) {
      return 0;
  }
  const prorationFactor = daysWithinPeriod / actualDurationDays;
  return prorationFactor * baseInterest;
}
//...................................FUNCTIONS_TO_DETERMINE_INTEREST_CHARGED_IN_A_SPECIFIC_PERIOD..........

/**
 * Calculates the borrowing limit multiplier based on interest paid and savings.
 * @param {number} interestPaid - Total interest paid in the last 12 months.
 * @param {number} currentSavings - Current savings amount.
 * @returns {number} - The multiplier to apply to savings to get the borrowing limit.
 */
export function getLimitMultiplier(interestPaid, currentSavings) {
  if (currentSavings <= 0) return CONSTANTS.INTEREST_MULTIPLIER_RULES.minMultiplier;

  const interestRatio = interestPaid / currentSavings;

  // If borrower paid little interest, they get the max multiplier
  if (interestRatio <= CONSTANTS.INTEREST_MULTIPLIER_RULES.minInterestRatio) return CONSTANTS.INTEREST_MULTIPLIER_RULES.maxMultiplier;

  // If borrower paid a lot of interest, they get the min multiplier
  if (interestRatio >= CONSTANTS.INTEREST_MULTIPLIER_RULES.maxInterestRatio) return CONSTANTS.INTEREST_MULTIPLIER_RULES.minMultiplier;

  // Linearly interpolate multiplier between max and min
  const ratioRange = CONSTANTS.INTEREST_MULTIPLIER_RULES.maxInterestRatio - CONSTANTS.INTEREST_MULTIPLIER_RULES.minInterestRatio;
  const multiplierRange = CONSTANTS.INTEREST_MULTIPLIER_RULES.maxMultiplier - CONSTANTS.INTEREST_MULTIPLIER_RULES.minMultiplier;
  const position = (CONSTANTS.INTEREST_MULTIPLIER_RULES.maxInterestRatio - interestRatio) / ratioRange;

  return Math.round(100 * (CONSTANTS.INTEREST_MULTIPLIER_RULES.minMultiplier + (multiplierRange * position))) / 100;
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
  const actualInterest = (totalRate * loanAmount) - (pointsSpent * CONSTANTS.POINTS_VALUE_PER_UNIT);
  const installmentAmount = Math.round((loanAmount + actualInterest) / loanDuration);

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
    pointsNeeded = Math.max(0, (totalRate - (CONSTANTS.MONTHLY_LENDING_RATE * 6))) * loanAmount / CONSTANTS.POINTS_VALUE_PER_UNIT;
  } else {
    pointsNeeded = (0.12 * loanAmount / CONSTANTS.POINTS_VALUE_PER_UNIT) +
      ((loanDuration - 18) * CONSTANTS.MONTHLY_LENDING_RATE * loanAmount / CONSTANTS.POINTS_VALUE_PER_UNIT);
  }

  // Determine actual points spent, limited by available points
  const pointsSpent = Math.min(pointsNeeded, borrowerPoints);

  return { pointsNeeded, pointsSpent };
}
//.....................HELPER_FUNCTIONS_FOR_INITIATING_STANDARD_LOANS...................................
//.............INITIATE_STD_LOAN

//....................APPROVE_STD_LOAN
/**
 * Approves a pending loan request and disburses funds.
 * @param {string} loanId - The ID of the loan to approve.
 * @param {object} approvedBy - The user approving the loan.
 * @param {Array<object>} sources - An array of objects { id: cashLocationId, amount: number } for disbursement.
 * @returns {Promise<object>} A promise that resolves to the updated loan document.
 * @throws {ErrorUtil.AppError} If loan not found, not pending, or disbursement fails.
 */
async function approveStandardLoanRequest(loan, approvedBy, sources, borrowerUser) {
  await Promise.all(
      sources.map(source =>
          CashLocationServiceManager.addToCashLocation(source.id, -source.amount)
      )
  );
  // Use Loan.updateOne directly
  const updatedLoanResult = await Loan.updateOne({ _id: loan._id }, {
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

//....................APPROVE_STD_LOAN

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

  const {totalInterestDue, pointsInterestDue, totalInterest } = calculateCashInterestDueAmount(loan, paymentDate, borrowerUser.points);

  // Distribute payment to principal and interest
  const paymentDistribution = calculateStandardLoanPrincipalPaid(paymentAmount, totalInterestDue, loan.principalLeft);

  if (paymentDistribution.excessAmount > 0) {
    Validator.assert(paymentDistribution.excessAmount >= 0, "Excess amount cannot be negative.", Errors.InternalServerError); // Defensive
    await handleExcessPayment(paymentDistribution.excessAmount, borrowerUser, cashLocationId, currentUser, paymentDate);
  }

  // Record points consumption and update user balance
  const pointsConsumed = calculatePointsConsumed(pointsInterestDue);

  if (pointsConsumed > 0) { 
    Validator.assert(pointsConsumed > 0, "Points consumed must be positive to redeem.", Errors.InternalServerError); // Defensive
    await PointsServiceManager.redeemPoints(borrowerUser._id, pointsConsumed, 'Loan Interest', '');
    await updateUserPointsBalance(borrowerUser._id, -pointsConsumed);
  }

  // Update loan properties based on payment distribution and points consumed
  const pendingDebt = await updateLoanAfterPayment(loan, paymentDistribution, (loan.pointsSpent || 0) + pointsConsumed, paymentDate);

  // Add the current payment to the loan's payments array
  loan.payments.push({
    amount: paymentAmount,
    date: paymentDate,
    location: cashLocationId,
    updatedBy: { id: currentUser._id, name: currentUser.fullName }
  });

  // Add payment to cash location (inflow)
  await CashLocationServiceManager.addToCashLocation(cashLocationId, paymentAmount);

  if (pendingDebt === 0) {
    loan.status = "Ended";
  }

  // Persist the updated loan document
  const updatedLoanRecordResult = await DB.query(loan.save());

  // Send notification
  let template = pendingDebt > 0 ? "loan-payment-confirmation.ejs" : "loan-cleared.ejs"; 

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

//.....................HELPER_FUNCTIONS_FOR_STANDARD_LOAN_PAYMENTS...................................
/**
 * Determines the payment distribution (how much goes to interest, how much to principal).
 * @param {number} paymentAmount - The total amount paid.
 * @param {number} totalInterestDue - The total calculated interest due.
 * @param {number} principalLeft - The remaining principal.
 * @returns {object} { interestPaid: number, principalPaid: number, excessAmount: number }
 */
export function calculateStandardLoanPrincipalPaid(paymentAmount, totalInterestDue, principalLeft) {
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
 * Calculates the total unpaid/due interest on a loan.
 * @param {number} amount - The amount for which interest is calculated.
 * @param {Date} startDate - The date from which interest is calculated.
 * @param {Date} dueDate - The date up to which interest is calculated.
 * @returns {number} The total interest due.
 */
function calculateTotalInterestDueAmount(loan, amount, lastPaymentDate, loanStartDate, dueDate) {
  let totalMonthsDue = loan.payments.length == 0 ? calculateTotalMonthsDue(loan.date, dueDate) : calculateTotalMonthsDue(loan.date, dueDate) - calculateTotalMonthsDue(loan.date, loan.lastPaymentDate);
  if (totalMonthsDue == 0 && loan.payments.length == 0) {
    totalMonthsDue = 1;
  }
  let totalAmount = amount * Math.pow((1 + CONSTANTS.MONTHLY_LENDING_RATE), totalMonthsDue);
  return Math.max(0, totalAmount - amount);

}

/**
 * Calculates unpaid/due interest on a loan that must be cleared with cash/money (points cannot be used).
 * @param {object} loan - The loan document.
 * @param {Date} dueDate - The date up to which interest is calculated.
 * @param {number} availablePoints - The borrower's current available points.
 * @returns {number} The interest amount that must be paid with cash.
 */
function calculateCashInterestDueAmount(loan, dueDate = new Date(), availablePoints) {
  let totalInterestDue = calculateTotalInterestDueAmount(loan, loan.principalLeft, loan.lastPaymentDate, loan.date, dueDate);
  const pointsInterestDue = calculatePointsInterestDueAmount(loan, availablePoints, dueDate); 
  totalInterestDue = Math.max(0, totalInterestDue - pointsInterestDue);
  let totalInterest = totalInterestDue + loan.interestAmount;
//console.log( totalInterestDue, loan.lastPaymentDate, pointsInterestDue )
  return { totalInterestDue, totalInterest, pointsInterestDue }; 
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
  const totalInterestDue = calculateTotalInterestDueAmount(loan, loan.principalLeft, loan.lastPaymentDate, loan.date, dueDate);
  let  totalMonthsDue = loan.payments.length == 0 ? calculateTotalMonthsDue(loan.date, dueDate) : calculateTotalMonthsDue(loan.date, dueDate) - calculateTotalMonthsDue(loan.date, loan.lastPaymentDate);
  if (totalMonthsDue == 0 && loan.payments.length == 0) {
    totalMonthsDue = 1;
  }
  const pointMonthsDue = calculatePointsMonthsDue(loan.date, loan.lastPaymentDate, dueDate);
//console.log({"totalInterestDue": totalInterestDue, "totalMonthsDue": totalMonthsDue, "pointMonthsDue": pointMonthsDue});
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
 * Calculates number of unpaid/due months whose interest can be cleared with points.
 * @param {Date} loanStartDate - The original loan start date.
 * @param {Date} lastPaymentDate - The date of the last payment.
 * @param {Date} currentDueDate - The current date for calculating due months.
 * @returns {number} The number of point-eligible months due.
 */
function calculatePointsMonthsDue(loanStartDate, lastPaymentDate, currentDueDate) {
  const totalPointMonthsAccrued = calculatePointMonthsAccrued(loanStartDate, currentDueDate);
  const clearedPointMonths = calculatePointMonthsAccrued(loanStartDate, lastPaymentDate);
  return Math.max(0, totalPointMonthsAccrued - clearedPointMonths);
}

/**
 * Adjusts a user's points balance.
 * @param {string} userId - ID of the user.
 * @param {number} pointsChange - Amount to change (positive for add, negative for deduct).
 */
async function updateUserPointsBalance(userId, pointsChange) {
  Validator.required({ userId, pointsChange });

  if (pointsChange !== 0) {
    await UserServiceManager.updateUser(userId, { $inc: { "points": pointsChange } });
  }
}

/**
 * Updates the loan document based on payment distribution.
 * @param {object} loan - The loan document (to be mutated).
 * @param {object} paymentDistribution - Result from calculateStandardLoanPrincipalPaid.
 * @param {number} pointsSpentOnLoan - The total points spent on this loan so far.
 */
export function updateLoanAfterPayment(loan, paymentDistribution, pointsSpentOnLoan, paymentDate) {
  Validator.required({ loan, paymentDistribution, pointsSpentOnLoan, paymentDate });
  const { interestPaid, principalPaid } = paymentDistribution;

  let loanUnits = getDaysDifference(loan.lastPaymentDate, paymentDate) * loan.principalLeft;

  loan.principalLeft -= principalPaid;
  loan.interestAmount += interestPaid; 

  // If loan is fully paid
  if (loan.principalLeft <= 0 && loan.interestAmount <= 0) {
    loan.principalLeft = 0;
    loan.status = "Ended";
    loan.duration = calculateTotalMonthsDue(loan.date, paymentDate);
    loan.pointsSpent = pointsSpentOnLoan;
    loan.units += loanUnits;
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
  Validator.assert(excessAmount >= 0, "Excess amount must be non-negative.", Errors.InternalServerError);
  Validator.assert(CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD !== undefined && CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD !== null,
    "CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD is not defined.", Errors.InternalServerError );
 const cashDestination = await CashLocationServiceManager.getCashLocationById(cashLocationId);

    const depositDocument = {
      _id: uuidv4(),
      depositor: { _id: borrowerUser._id.toString(), fullName: borrowerUser.fullName },
      amount: excessAmount,
      type: "Permanent",
      cashLocation: { _id: cashLocationId.toString(), name: cashDestination.name },
      source: "Excess Loan Payment",
      date: paymentDate,
      recordedBy: { _id: currentUser._id.toString(), fullName: currentUser.fullName }
    };

  if (excessAmount >= CONSTANTS.MIN_EXCESS_DEPOSIT_THRESHOLD) {
    await DepositServiceManager.recordDeposit(depositDocument);
    return '';
  }

  return '';
}
//.....................HELPER_FUNCTIONS_FOR_STANDARD_LOAN_PAYMENTS...................................

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
    Errors.AppError 
  );

  Validator.assert(duration <= loanPeriodLimit,
    `The Loan Period of ${Math.round(loanPeriodLimit).toLocaleString('en-US')} has been exceeded!`,
    Errors.AppError 
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
  Validator.assert(user.temporaryInvestment?.amount !== undefined && user.temporaryInvestment?.units !== undefined,
    "User temporary savings data is incomplete.", Errors.InternalServerError );

  const totalDaysSinceDeposit = getDaysDifference(user.temporaryInvestment.unitsDate, new Date());

  const loanPeriodLimit = requestedAmount > 0
    ? Math.round((user.temporaryInvestment?.amount * totalDaysSinceDeposit + user.temporaryInvestment?.units) / requestedAmount)
    : 0;

  const loanLimit = requestedPeriod > 0
    ? Math.round((user.temporaryInvestment?.amount * totalDaysSinceDeposit + user.temporaryInvestment?.units) / requestedPeriod)
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
  
  const updatedLoanResult = await Loan.updateOne({ _id: loan._id }, {
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
  currentUser,
  
) {
  Validator.required({ loan, borrowerUser, paymentAmount, paymentDate, cashLocationId, currentUser });

  const parsedPaymentDate = new Date(paymentDate);
  const formattedDate = parsedPaymentDate.toLocaleDateString("en-US", { 
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  Validator.assert(new Date(loan.date).getTime() <= parsedPaymentDate.getTime(),
    "Payment date cannot be before the loan initiation date!",
    Errors.AppError 
  );

  await calculateFreeLoanPrincipleLeft(loan, borrowerUser, paymentAmount, parsedPaymentDate); 

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
 * @param {object} user - The borrower's user document, containing temporaryInvestment?.amount and temporaryInvestment?.units.
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
  Validator.assert(paymentAmount >= 0, "Payment amount cannot be negative.", Errors.BadRequestError);
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
  Validator.assert(paymentAmount >= 0, "Payment amount cannot be negative.", Errors.BadRequestError);
  Validator.assert(cashInterest >= 0, "Cash interest cannot be negative.", Errors.InternalServerError);

  Validator.assert((paymentAmount - loan.principalLeft) >= cashInterest,
    "Payment amount is insufficient to cover accrued cash interest and principal.",
    Errors.AppError 
  );

  // If payment covers principal and cash interest
  await UserServiceManager.addTemporaryInvestmentUnits(user._id, -user.temporaryInvestment?.units);
  await UserServiceManager.setTemporaryInvestmentUnitsDate(user._id, parsedPaymentDate);

  loan.principalLeft = 0;
  loan.status = "Ended";
  loan.interestAmount = cashInterest;
  loan.duration = calculateTotalMonthsDue(loan.date, parsedPaymentDate);
}


export {
  calculateTotalMonthsDue,
  calculatePointMonthsAccrued,
  initiateStandardLoanRequest,
  getLoanEffectiveEndDate,
  getInterestForLoansStartedAndEndedWithinPeriod,
  getProroratedInterestForStartedBeforePeriodEndedBeforePeriod,
  getProroratedInterestForStartedAfterPeriodEndedAfterPeriod,
  getInterestForLoansSpanningPeriod,
  approveStandardLoanRequest,
  processStandardLoanPayment,
  calculateTotalInterestDueAmount,
  calculateCashInterestDueAmount,
  calculatePointsInterestDueAmount,
  calculatePointsMonthsDue,
  updateUserPointsBalance,
  handleExcessPayment,
  initiateFreeLoanRequest,
  approveFreeLoanRequest,
  processFreeLoanPayment,
  calculateFreeLoanPrincipleLeft,
  calculateFreeLoanOverdueMetrics,
  handlePartialPrincipalPayment,
  handleExcessUnitsNoCashInterest,
  handleCashInterestPayment,
};