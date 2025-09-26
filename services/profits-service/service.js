
import { ACCOUNT_BALANCE_RANGES, categorizeAmounts } from "../../utils/financial-analytics-util.js";
import CONSTANTS from "../../src/config/constants.js";
import { getDaysDifference } from "../../utils/date-util.js";
import * as Errors from "../../utils/error-util.js";
import * as Validator from "../../utils/validator-util.js";
import * as DB from "../../utils/db-util.js";

// Models 
import { Earnings, Units, FundTransactions, MonthlyInterestRecord } from "./models.js"; 

// Collaborator Services
import * as UserServiceManager from "../user-service/service.js";
import * as DepositServiceManager from "../deposit-service/service.js";
import * as LoanServiceManager from "../loan-service/service.js";
import * as EmailServiceManager from "../email-service/service.js";
import * as DateUtil from "../../utils/date-util.js";

const LOAN_TEMPLATES_PATH = "./email-templates.js"; 

/**
 * Retrieves a list of earnings based on filter, sort, and pagination criteria.
 * @param {object} params - Object containing filter, sort, and pagination.
 * @returns {Promise<Array>} A promise that resolves to an array of earnings documents.
 */
export async function getEarnings(filter) {
  // No filter? Return everything.
  if (!filter) {
    return await DB.query(Earnings.find({}));
  }

  // Filter provided: resolve user and query by fullName.
  const user = await UserServiceManager.getUserById(filter);
  if (!user) return []; // user id not found → no earnings

  return await DB.query(Earnings.find({ fullName: user.fullName }));
}

export async function getUnits(filter) {
  // No filter? Return everything.
  if (!filter) {
    return await DB.query(Units.find({}));
  }

  // Filter provided: resolve user and query by fullName (NOT userName).
  const user = await UserServiceManager.getUserById(filter);
  if (!user) return []; // user id not found → no units

  return await DB.query(Units.find({ fullName: user.fullName }));
}


/**
 * Fetches and processes earning records to categorize members based on their total earning amounts,
 * and also returns each member's total earnings with names.
 *
 * @param {Array<object>} earningRecords - An array of earning documents, ideally already filtered.
 * Expected structure: { member: { id: '...', name: '...' }, amount: number, ... }
 * @returns {Promise<object>} An object containing:
 * - standings: Array of earning account standings by range.
 * - memberTotals: Array of objects where each object is { id: string, name: string, total: number }.
 */
export async function generateEarningAccountStandings(earningRecords) {
    const memberEarningTotalsById = {}; // Aggregate by ID
    const memberInfoMap = {};           // Map to store member's name

    earningRecords.forEach(record => {
        const memberId = record.member.id.toString(); 
        const memberName = record.member.name;

        if (!memberEarningTotalsById[memberId]) {
            memberEarningTotalsById[memberId] = 0;
            memberInfoMap[memberId] = memberName;
        }
        memberEarningTotalsById[memberId] += record.amount;
    });

    const memberEarningTotals = Object.keys(memberEarningTotalsById).map(memberId => ({
        id: memberId,
        name: memberInfoMap[memberId],
        total: memberEarningTotalsById[memberId]
    }));

    const earningStandings = categorizeAmounts(memberEarningTotalsById, ACCOUNT_BALANCE_RANGES);

    return {
        standings: earningStandings,
        memberTotals: memberEarningTotals
    };
}


/**
 * Determines if a loan's CURRENT DURATION (from start to specified date)
 * qualifies it for "utilizing points" based on defined thresholds.
 *
 * @param {Date} loanStartDate - The original start date of the loan.
 * @param {Date} currentDate - The date up to which to calculate the loan's elapsed duration (e.g., current month's start).
 * @returns {boolean} True if the loan's elapsed duration falls into the point-eligible period, false otherwise.
 */
function isLoanCurrentlyUtilizingPoints(loanStartDate, currentDate) {
    let elapsedMonths = getDaysDifference(loanStartDate, currentDate) / 30;
    const condition1 = elapsedMonths > CONSTANTS.ONE_YEAR_MONTH_THRESHOLD && elapsedMonths < CONSTANTS.ONE_YEAR_MONTHS;
    const condition2 = elapsedMonths > CONSTANTS.TWO_YEAR_MONTH_THRESHOLD;

    return condition1 || condition2;
}

/**
 * Calculates and records the total cash interest accrued for the new month.
 * This function is intended to be run automatically at the start of each month.
 *
 * @param {Date} currentMonthStartDate - The first day of the month for which to calculate interest.
 * e.g., new Date(2025, 6, 1) for July 2025.
 * @returns {Promise<object>} A promise that resolves to the created monthly interest record.
 * @throws {ErrorUtil.AppError} If required data is missing or database operations fail.
 */
export async function recordMonthlyAccruedInterest(currentMonthStartDate) {
  Validator.required({ currentMonthStartDate });
  Validator.assert(currentMonthStartDate instanceof Date && !isNaN(currentMonthStartDate),
    "Invalid currentMonthStartDate provided.", { errType: Errors.BadRequestError });

  // Format for unique key "YYYY-MM"
  const monthYearKey = `${currentMonthStartDate.getFullYear()}-${(currentMonthStartDate.getMonth() + 1).toString().padStart(2, '0')}`;

  // Prevent duplicate entries for the same month
  const existingRecord = await DB.query(MonthlyInterestRecord.findOne({ monthYear: monthYearKey }));
  Validator.assert(!existingRecord,
    `Monthly interest record for ${monthYearKey} already exists.`,
    { errType: Errors.AppError, statusCode: 409 } 
  );

  const ongoingLoans = LoanServiceManager.getLoans({ status: "Ongoing" });

  let totalPrincipalForInterestCalculation = 0;

  // Iterate through all ongoing loans
  for (const loan of ongoingLoans) {
    // Check if the loan's *current duration* makes it eligible for points
    const loanUtilizesPoints = isLoanCurrentlyUtilizingPoints(loan.date, currentMonthStartDate);

    // If the loan is NOT currently utilizing points, add its principalLeft to the sum
    if (!loanUtilizesPoints) {
      totalPrincipalForInterestCalculation += loan.principalLeft;
    }
  }

  // Calculate the total cash interest for the month based on the filtered principal
  const totalCashInterestAccrued = totalPrincipalForInterestCalculation * CONSTANTS.MONTHLY_LENDING_RATE;

  // Create and persist the simplified monthly interest record
  const newMonthlyRecord = await DB.query(MonthlyInterestRecord.create({
    monthYear: monthYearKey,
    totalCashInterestAccrued: totalCashInterestAccrued,
  }));

  return newMonthlyRecord;
} 


/**
 * Calculates the total interest made in a given year by summing monthly records
 * and adding a specified unitsTrustsInterest.
 *
 * @param {number} year - The year for which to calculate total interest (e.g., 2025).
 * @param {number} unitsTrustsInterest - Additional interest amount from units/trusts to include.
 * @returns {Promise<number>} The total interest made in the year.
 * @throws {ErrorUtil.AppError} If validation fails.
 */
async function calculateAnnualTotalInterest(year, unitsTrustsInterest) {
  Validator.required({ year, unitsTrustsInterest });
  Validator.assert(typeof year === 'number' && year > 1900 && year < 3000,
    "Invalid year provided.", { errType: Errors.BadRequestError });
  Validator.assert(typeof unitsTrustsInterest === 'number' && unitsTrustsInterest >= 0,
    "Units trust interest must be a non-negative number.", { errType: Errors.BadRequestError });

  // Get all monthly interest records for the specified year
  const monthlyRecords = await DB.query(MonthlyInterestRecord.find({
    monthYear: { $regex: `^${year}-` } 
  }));

  let totalInterestFromLoans = 0;
  for (const record of monthlyRecords) {
    totalInterestFromLoans += record.totalCashInterestAccrued;
  }

  const totalAnnualInterest = totalInterestFromLoans + unitsTrustsInterest;
  return totalAnnualInterest;
}

/**
 * Calculates the investment units for each member based on their initial investment
 * and deposits within a specified year.
 *
 * @param {Array<object>} members - An array of member (user) objects. Each member
 * should have properties like `_id`, `fullName`, `investmentDate`, `investmentAmount`.
 * @param {number} year - The year for which to calculate deposits' contribution to units.
 * @returns {Promise<object>} An object containing `memberUnitsData` (array of {id, name, units})
 * and `totalAllUnits` (sum of all members' units).
 * @throws {ErrorUtil.AppError} If validation fails or data is missing.
 */
async function calculateMemberInvestmentUnits(members, year) {
  Validator.required({ members, year });
  Validator.assert(Array.isArray(members), "Members must be an array.", { errType: Errors.BadRequestError });
  Validator.assert(typeof year === 'number' && year > 1900 && year < 3000,
    "Invalid year provided.", { errType: Errors.BadRequestError });

  let allUnits = 0;
  const memberUnitsData = [];
  const endOfYear = new Date(year, 11, 31); 

  for (const member of members) {
    Validator.required({
      memberId: member._id,
      memberName: member.fullName,
      memberInvestmentDate: member.investmentDate,
      memberInvestmentAmount: member.investmentAmount
    });
    Validator.assert(member.investmentAmount >= 0, `Investment amount for ${member.fullName} cannot be negative.`, { errType: Errors.InternalServerError });

    let totalMemberUnits = 0;
    let yearDepositsAmount = 0;

    const investmentDays = getDaysDifference(member.investmentDate, endOfYear);
    Validator.assert(investmentDays >= 0, `Investment date for ${member.fullName} is in the future.`, { errType: Errors.BadRequestError });

    // Fetch member's deposits for the current year
    const allMemberDeposits = await DB.query(Deposit.find({
      $or: [
        { depositor: member._id }, // If depositor is ObjectId
        { depositor_name: member.fullName } // If depositor is by name
      ],
      deposit_date: { $gte: new Date(year, 0, 1), $lte: endOfYear }
    }));

    for (const deposit of allMemberDeposits) {
      Validator.required({
        depositAmount: deposit.deposit_amount,
        depositDate: deposit.deposit_date
      });
      Validator.assert(deposit.deposit_amount >= 0, `Deposit amount for ${member.fullName} cannot be negative.`, { errType: Errors.InternalServerError });

      const depositDays = getDaysDifference(deposit.deposit_date, endOfYear);
      Validator.assert(depositDays >= 0, `Deposit date for ${member.fullName} is in the future.`, { errType: Errors.BadRequestError });

      const depositUnits = deposit.deposit_amount * depositDays;
      totalMemberUnits += depositUnits;
      yearDepositsAmount += deposit.deposit_amount;
    }

    totalMemberUnits += investmentDays * (member.investmentAmount - yearDepositsAmount);

    allUnits += totalMemberUnits;
    memberUnitsData.push({ id: member._id.toString(), name: member.fullName, units: totalMemberUnits });
  }

  return { memberUnitsData, totalAllUnits: allUnits };
}

/**
 * Orchestrates the annual profit distribution process.
 * Calculates total annual profit, determines each member's share based on investment units,
 * and records earnings/re-investments.
 *
 * @param {Array<object>} membersProfitStatus - Array of objects { memberId: string, profitStatus: "re-invest" | "withdraw" }.
 * @param {number} year - The year for which profits are being distributed.
 * @param {number} unitsTrustsInterest - Additional interest from units/trusts to include in total profit.
 * @param {object} currentUser - The user recording the distribution (for 'recordedBy' fields).
 * @param {string} [reinvestCashLocationId] - Optional: The ID of the cash location for re-invested funds.
 * Required if any member's profitStatus is "re-invest".
 * @returns {Promise<object>} A confirmation object with details of the distribution.
 * @throws {ErrorUtil.AppError} If validation fails, members not found, or distribution issues.
 */
export async function distributeAnnualProfits(
  membersProfitStatus,
  year,
  unitsTrustsInterest,
  currentUser,
  reinvestCashLocationId = null // Default to null, will be validated if needed
) {
  Validator.required({ membersProfitStatus, year, unitsTrustsInterest, currentUser });
  Validator.assert(Array.isArray(membersProfitStatus), "membersProfitStatus must be an array.", { errType: Errors.BadRequestError });
  Validator.assert(typeof year === 'number' && year > 1900 && year < 3000,
    "Invalid year provided.", { errType: Errors.BadRequestError });
  Validator.assert(typeof unitsTrustsInterest === 'number' && unitsTrustsInterest >= 0,
    "Units trust interest must be a non-negative number.", { errType: Errors.BadRequestError });
  Validator.required({ currentUserId: currentUser._id, currentUserFullName: currentUser.fullName });

  // 1. Calculate Total Annual Profit
  const totalProfit = await calculateAnnualTotalInterest(year, unitsTrustsInterest);
  Validator.assert(totalProfit >= 0, "Calculated total profit cannot be negative.", { errType: Errors.InternalServerError });
  const clubTax = Math.round(totalProfit * CONSTANTS.ANNUAL_TAX_RATE);
  const amountForDistribution = totalProfit * (1 - CONSTANTS.ANNUAL_TAX_RATE);

  // 2. Get All Members' Full Details
  // Fetch all users to ensure we have their investment details for unit calculation
  const allMembers = await UserServiceManager.getUsers();
  Validator.assert(allMembers && allMembers.length > 0, "No members found to distribute profits to.", { errType: Errors.AppError, statusCode: 404 });

  // Create a map for quick lookup of member details
  const memberMap = new Map(allMembers.map(m => [m._id.toString(), m]));

  // 3. Calculate Investment Units for Each Member
  const { memberUnitsData, totalAllUnits } = await calculateMemberInvestmentUnits(allMembers, year);
  Validator.assert(totalAllUnits > 0, "Total investment units for distribution must be positive.", { errType: Errors.AppError, statusCode: 400 });

  const distributionSummary = {
    totalProfitDistributed: 0,
    membersDistributed: 0,
    reinvestedAmount: 0,
    withdrawnAmount: 0,
    errors: []
  };

  // 4. Distribute Profit to Each Member
  for (const memberStatus of membersProfitStatus) {
    try {
      Validator.required({ memberId: memberStatus.memberId, profitStatus: memberStatus.profitStatus });
      Validator.assert(['re-invest', 'withdraw'].includes(memberStatus.profitStatus),
        `Invalid profit status for member ${memberStatus.memberId}: ${memberStatus.profitStatus}. Must be 're-invest' or 'withdraw'.`,
        { errType: Errors.BadRequestError });

      const memberDetails = memberMap.get(memberStatus.memberId);
      Validator.assert(memberDetails, `Member with ID ${memberStatus.memberId} not found.`, { errType: Errors.AppError, statusCode: 404 });

      const memberUnitEntry = memberUnitsData.find(m => m.id === memberStatus.memberId);
      Validator.assert(memberUnitEntry && memberUnitEntry.units >= 0, `Investment units not calculated for member ${memberDetails.fullName}.`, { errType: Errors.InternalServerError });

      const profitDue = (memberUnitEntry.units * amountForDistribution) / totalAllUnits;
      Validator.assert(profitDue >= 0, `Calculated profit due for ${memberDetails.fullName} is negative.`, { errType: Errors.InternalServerError });

      // Round profitDue to avoid floating point issues for financial records
      const roundedProfitDue = Math.round(profitDue);
      const returns = Math.round(roundedProfitDue * 365 * 100 / memberUnitEntry.units);

      if (roundedProfitDue === 0) {
        // Skip members with zero profit due, no record needed
        continue;
      }

      let earningsDestination = '';
      if (memberStatus.profitStatus === "re-invest") {
        Validator.required({ reinvestCashLocationId });
        Validator.assert(reinvestCashLocationId, "Re-investment cash location ID is required for 're-invest' status.", { errType: Errors.BadRequestError });

        // Record as a deposit
        await DepositServiceManager.createDeposit({
          depositor: memberDetails._id, // Use member's actual ID
          amount: roundedProfitDue,
          type: "Club Saving",
          balanceBefore: m.investmentAmount,
          cashLocation: { _id: reinvestCashLocationId, name: 'Profit Re-Investment' }, 
          source: "Profits",
          date: DateUtil.getToday(),
          recordedBy: { _id: currentUser._id, fullName: currentUser.fullName }
        });
        earningsDestination = "Re-Invested";
        distributionSummary.reinvestedAmount += roundedProfitDue;

      } else { // "withdraw"
        earningsDestination = "Withdrawn";
        distributionSummary.withdrawnAmount += roundedProfitDue;
      }

      // Record Earnings entry
      await DB.query(Earnings.create({
        fullName: memberDetails.fullName,
        _id: memberDetails._id, 
        date: DateUtil.getToday(),
        amount: roundedProfitDue,
        destination: earningsDestination,
        source: "Profits",
        status: "Sent" 
      }));

      // Record Units entry
      await DB.query(Units.create({
        fullName: memberDetails.fullName,
        year: year, 
        units: memberUnitEntry.units,
        }));

      distributionSummary.totalProfitDistributed += roundedProfitDue;
      distributionSummary.membersDistributed++;

      await EmailServiceManager.sendEmailWithTemplate({
        sender: "growthspring",
        recipient: memberDetails.email, 
        subject: "Your Earnings!",
        templateName: "profits-distributed.ejs",
        templateData: {
          user_first_name: memberDetails.displayName, 
          amount: roundedProfitDue,
          year: year,
          returns: returns,
          destination: earningsDestination 
        },
        templatesPath: LOAN_TEMPLATES_PATH
      });

    } catch (error) {
      console.error(`Error distributing profit for member ${memberStatus.memberId}:`, error);
      distributionSummary.errors.push({ memberId: memberStatus.memberId, error: error.message });
    }
  }
    // Record Fund Earnings entry
    await DB.query(FundTransactions.create({
    name: "Tax",
    date: DateUtil.getToday(),
    amount: clubTax,
    transaction_type: "Income",
    reason: "Profits",
    }));

    //Update Club Fund Account Balance
    await DB.query(ClubDatas.updateOne({}, { $inc: { clubFundWorth: clubTax } }));

  return {
    message: "Annual profit distribution processed.",
    summary: distributionSummary
  };
}
