// model
import { Loan, PointsSale } from "./models.js";
import mongoose from "mongoose"; 

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
import DateUtil from "../../utils/date-util.js";

/**
 * Transforms raw loan and payment data into a standardized financial record format.
 * @param {Array<object>} loans - An array of loan documents.
 * @returns {Array<object>} An array of standardized financial records.
 */
function transformLoansToFinancialRecords(loans) {
    const financialRecords = [];
  
    loans.forEach(loan => {
      financialRecords.push({
        type: 'Loan',
        amount: loan.amount,
        date: loan.date,
        name: loan.borrower.name,
        source: loan.sources && loan.sources.length > 0 ? loan.sources.map(s => s.name).join(', ') : 'Not Available',
        isOutflow: true,
      });
  
      if (loan.payments && loan.payments.length > 0) {
        loan.payments.forEach(payment => {
          financialRecords.push({
            type: 'Loan Payment',
            amount: payment.amount,
            date: payment.date,
            name: loan.borrower.name,
            destination: payment.location,
            isOutflow: false, 
          });
        });
      }
    });
    return financialRecords;
  }
  
  /**
   * Groups financial records by month and calculates inflow/outflow summaries.
   * @param {Array<object>} records - An array of financial records.
   * @returns {object} Monthly grouped financial summaries.
   */
  export function groupFinancialRecordsByMonth(records) {
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
   * Fetches all loan-related financial records (loan disbursements and payments).
   * @returns {Promise<Array<object>>} An array of loan and loan payment records.
   */
  export async function getLoanFinancialRecords() {
    const loans = await getLoans(); // Fetch all loans
    return transformLoansToFinancialRecords(loans);
  }
  
  /**
   * Fetches and groups all loan-related financial records by month.
   * @returns {Promise<object>} Monthly grouped financial summaries.
   */
  export async function getMonthlyLoanFinancialRecords() {
    const loanRecords = await getLoanFinancialRecords();
    loanRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return groupFinancialRecordsByMonth(loanRecords);
  }
  
  
  /**
   * Summarizes an array of loan documents, calculating various statistics.
   * @param {Array<object>} loans - An array of loan documents.
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
  
    loans.forEach(loan => {
      loan.status === "Ongoing"
        ? (loansSummary.ongoingLoansCount += 1)
        : (loansSummary.endedLoansCount += 1);
  
      loansSummary.totalPrincipal += loan.amount;
      loansSummary.principalLeft += loan.principalLeft;
  
      if (loan.status === "Ongoing") {
        loansSummary.expectedInterest += calculateTotalInterestDueAmount(loan, DateUtil.getToday());
      } else {
        loansSummary.interestPaid += loan.interestAmount; 
      }
  
      loansSummary.recievedInterest += loan.interestAmount; 
  
      if (loan.borrower && loan.borrower.name) {
        loansSummary.members.add(loan.borrower.name);
        if (loan.status === "Ongoing") {
          loansSummary.membersOngoingLoans.add(loan.borrower.name);
        } else {
          loansSummary.membersEndedLoans.add(loan.borrower.name);
        }
      }
    });
  
    return loansSummary;
  }
  

  
/**
 * Aggregates total loan amounts and collects member information from loan records.
 * @param {Array<object>} loanRecords - An array of loan documents.
 * @returns {object} An object containing:
 * - memberLoanTotalsById: { memberId: totalAmount }
 * - memberInfoMap: { memberId: memberName }
 * - memberMonthlyActivity: Map<memberId, Set<YYYY-MM>>
 * - allUniqueMonths: Set<YYYY-MM>
 */
function aggregateLoanRecordData(loanRecords) {
  const memberLoanTotalsById = {};
  const memberInfoMap = {};
  const memberMonthlyActivity = new Map();
  const allUniqueMonths = new new Set();

  loanRecords.forEach(record => {
    const memberId = record.borrower.id.toString();
    const memberName = record.borrower.name;
    const recordDate = new Date(record.date);
    const monthYear = `${recordDate.getFullYear()}-${(recordDate.getMonth() + 1).toString().padStart(2, '0')}`;

    if (!memberLoanTotalsById[memberId]) {
      memberLoanTotalsById[memberId] = 0;
      memberInfoMap[memberId] = memberName;
    }
    memberLoanTotalsById[memberId] += record.amount;

    if (!memberMonthlyActivity.has(memberId)) {
      memberMonthlyActivity.set(memberId, new Set());
    }
    memberMonthlyActivity.get(memberId).add(monthYear);

    allUniqueMonths.add(monthYear);
  });

  return { memberLoanTotalsById, memberInfoMap, memberMonthlyActivity, allUniqueMonths };
}

/**
 * Transforms aggregated member loan totals into an array with member names.
 * @param {object} memberLoanTotalsById - { memberId: totalAmount }
 * @param {object} memberInfoMap - { memberId: memberName }
 * @returns {Array<object>} An array of objects { id: string, name: string, total: number }.
 */
function formatMemberLoanTotals(memberLoanTotalsById, memberInfoMap) {
  return Object.keys(memberLoanTotalsById).map(memberId => ({
    id: memberId,
    name: memberInfoMap[memberId],
    total: memberLoanTotalsById[memberId]
  }));
}

/**
 * Calculates the monthly activity frequency categories for members.
 * @param {Map<string, Set<string>>} memberMonthlyActivity - Map of memberId to a Set of 'YYYY-MM' strings.
 * @param {Set<string>} allUniqueMonths - Set of all unique 'YYYY-MM' strings covered by records.
 * @param {object} memberLoanTotalsById - Used to iterate through all members who borrowed.
 * @returns {object} An object containing totalMonthsCovered, uniqueMonths, and categories.
 */
function calculateActivityFrequency(memberMonthlyActivity, allUniqueMonths, memberLoanTotalsById) {
  const totalMonthsCovered = allUniqueMonths.size;
  const activityCountsByMembers = {};

  for (let i = 0; i <= totalMonthsCovered; i++) {
    activityCountsByMembers[i] = 0;
  }

  for (const memberId of Object.keys(memberLoanTotalsById)) {
    const activeMonthsForMember = memberMonthlyActivity.get(memberId)?.size || 0;
    activityCountsByMembers[activeMonthsForMember]++;
  }

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
    totalMonthsCovered: totalMonthsCovered,
    uniqueMonths: Array.from(allUniqueMonths).sort(),
    categories: activityFrequencyCategories
  };
}

/**
 * Fetches and processes loan records to categorize members based on their total loan amounts,
 * returns each member's total loans with names, and categorizes members by their monthly activity frequency.
 *
 * @param {Array<object>} loanRecords - An array of loan documents.
 * Expected structure: { borrower: { id: '...', name: '...' }, amount: number, date: Date, ... }
 * @returns {Promise<object>} An object containing:
 * - standings: Array of loan account standings by range.
 * - memberTotals: Array of objects where each object is { id: string, name: string, total: number }.
 * - activityFrequency: Object detailing monthly activity.
 */
export async function generateLoanAccountStandings(loanRecords) {
  const { memberLoanTotalsById, memberInfoMap, memberMonthlyActivity, allUniqueMonths } =
    aggregateLoanRecordData(loanRecords);

  const memberTotals = formatMemberLoanTotals(memberLoanTotalsById, memberInfoMap);
  const loanStandings = categorizeAmounts(memberLoanTotalsById, ACCOUNT_BALANCE_RANGES);
  const activityFrequency = calculateActivityFrequency(memberMonthlyActivity, allUniqueMonths, memberLoanTotalsById);

  return {
    standings: loanStandings,
    memberTotals: memberTotals,
    activityFrequency: activityFrequency
  };
}


//for free loans eligibility for dashboard, use amounts as fraction of current deposit, or period as one year