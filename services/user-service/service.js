import path from "path"
import { Appearance, User } from "./models.js"
import fs from "fs"
import mongoose from "mongoose"
import { fileURLToPath } from "url"

const fileURL = import.meta.url
const filePath = fileURLToPath(fileURL)
const moduleDirectory = path.dirname(filePath)
const publicDirectory = path.join(moduleDirectory, "..", "..", "public")

//utils
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as DateUtil from "../../utils/date-util.js"
import * as Validator from "../../utils/validator-util.js"
import { getDaysDifference } from "../../utils/date-util.js";
import { ACCOUNT_BALANCE_RANGES, categorizeAmounts, getTotalSumsAndSort } from "../../utils/financial-analytics-util.js";

import CONSTANTS from '../../src/config/constants.js'; 

//collaborator services
import * as AuthServiceManager from "../auth-service/service.js"
import * as DepositServiceManager from "../deposit-service/service.js"
import * as PointServiceManager from "../point-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"
import * as CashLocationServiceManager from '../cash-location-service/service.js';
import * as LoansServiceManager from '../loan-service/service.js';
import * as EarningsServiceManager from '../profits-service/service.js';

import * as Schemas from "./schemas.js"

export async function getUsers(){
  const users = await DB.query(User.find())
  return users
}

export async function getUserById(userId){
  Validator.schema(Schemas.getUserById, userId)
  const user = await DB.query(User.findById(userId))
  if (!user) throw new Errors.NotFoundError("Failed to find user")
  return user
}

export async function getUserByEmail(email){
  Validator.schema(Schemas.getUserByEmail, email)
  const user = DB.query(await User.findOne({email}))
  if (!user) throw new Errors.NotFoundError("Failed to find user")
  return user
}

export async function getUserDashboardAppearance(userId){
  const dashboards = await Appearance.find({});
  if (!dashboards) throw new Errors.NotFoundError("Failed to find user")
  return dashboards.find(d => d.userId == userId)  
}

export async function getUserDashboard(userId){
  const currentYear = new Date().getFullYear();
  const year = currentYear;
  const status = "Ongoing"

  const filter1 = {userId};
  const filter2 = {}//All records for all members
  const filter3 = {year}
  const filter4 = {userId, year}
  const filter5 = {userId, status}

  const [
    member,
    dashboardAppearance,
    allMembers,
    memberDeposits,
    allDeposits,
    pointsTransactions,
    memberEarnings,
    allEarnings,
    memberLoans,
    ongoingMemberLoans,
    thisYearMemberLoans,
    allLoans,
    allThisYearLoans,
    allUnits,
    clubDeposits,
  ] = await Promise.all([
    getUserById(userId),
    getUserDashboardAppearance(userId),
    getUsers(),
    DepositServiceManager.getDeposits(filter1),
    DepositServiceManager.getDeposits(filter2),
    PointServiceManager.getTransactions(filter1),
    EarningsServiceManager.getEarnings(filter1),
    EarningsServiceManager.getEarnings(filter2),
    LoansServiceManager.getLoans(filter1),
    LoansServiceManager.getLoans(filter5),
    LoansServiceManager.getLoans(filter4),
    LoansServiceManager.getLoans(filter2),
    LoansServiceManager.getLoans(filter3),
    EarningsServiceManager.getUnits(filter2),
    DepositServiceManager.getYearlyDeposits()
  ])

  // ---- helpers ----
  function processArray(array, transformFn, noDataValue = 'No Data Available') {
    if (!Array.isArray(array) || array.length === 0) return noDataValue;
    return transformFn(array);
  }

  function formatDate(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  const monthsPassedThisYear = (new Date().getMonth() + 1); // 1..12
  const formatCurrency = (amount) => {
    const safe = Number(amount || 0);
    return 'UGX ' + Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(safe);
  };
  const safeNumber = v => Number(v || 0);

  // Format deposit & earnings for the member
  const depositsProcessed = processArray(memberDeposits.filter(t => t.type === "Permanent"), arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const temporarySavingsProcessed = processArray(memberDeposits.filter(t => t.type === "Temporary"), arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const thisYearTemporaryDepositsSum = (temporarySavingsProcessed?.yearsSums?.[currentYear]?.amount) || 0;
  const thisYearDepositsSum = (depositsProcessed?.yearsSums?.[currentYear]?.amount) || 0;
  const totalTemporarySavingsEver = memberDeposits.filter(t => t.type === "Temporary").reduce((t, l) => t + (l.amount || 0), 0);
  
  const earningsProcessed = processArray(memberEarnings.filter(t => t.source === "Permanent Savings"), arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const totalEarnings = memberEarnings.filter(t => t.source === "Permanent Savings").reduce((t, l) => t + (l.amount || 0), 0);
  const thisYearEarningsSum = (earningsProcessed?.yearsSums?.[currentYear]?.amount) || 0;

  const savingsEarningsProcessed = processArray(memberEarnings.filter(t => t.source === "Temporary Savings"), arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const totalSavingsEarnings = memberEarnings.filter(t => t.source === "Temporary Savings").reduce((t, l) => t + (l.amount || 0), 0);
  const thisYearSavingsEarningsSum = (savingsEarningsProcessed?.yearsSums?.[currentYear]?.amount) || 0;

  //Past years units
  const memberUnits = allUnits.filter(t => t.name === member.fullName);
  const totalMemberUnits = memberUnits.reduce((t, l) => t + (l.units || 0), 0);

  // Calculate Member Ownership
  let allCurrentUnits = 0;
  let people = [];
  let memberNames = [];

  for (const member of allMembers) {
      memberNames.push(member.fullName);
      const investmentDays = getDaysDifference(member.permanentInvestment.unitsDate, new Date());
      let totalUnits = investmentDays * member.permanentInvestment.amount + member.permanentInvestment.units;
      
      allCurrentUnits += totalUnits;
      people.push({name: member.fullName, units: totalUnits});
  }

  const currentMemberInfo = people.find(item => item.name === member.fullName);
  const ownershipPercentage = currentMemberInfo.units/allCurrentUnits;

  // points & credits
  const pointsRecordsProcessed = processArray(pointsTransactions, arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const pointsSpentTransactions = pointsTransactions.filter(t => t.type === "redeem");
  const totalPointsRedeemed = pointsSpentTransactions.reduce((t, l) => t + (l.points || 0), 0);
  const pointsEarnedTransactions = pointsTransactions.filter(t => t.type !== "redeem");
  const totalPointsEarned = pointsEarnedTransactions.reduce((t, l) => t + (l.points || 0), 0);

  // points this year (safe)
  const pointsThisYearEarned = pointsEarnedTransactions.filter(p => new Date(p.date).getFullYear() === currentYear)
      .reduce((t, p) => t + (p.points || 0), 0);
  const pointsThisYearRedeemed = pointsSpentTransactions.filter(p => new Date(p.date).getFullYear() === currentYear)
      .reduce((t, p) => t + (p.points || 0), 0);

  const pointUnitValue = (typeof CONSTANTS !== 'undefined' && CONSTANTS?.POINTS_VALUE_PER_UNIT) ? CONSTANTS.POINTS_VALUE_PER_UNIT : 1000;
  const pointsWorth = Math.round(pointUnitValue * (member.points || 0));
  
  // member debt totals & loans
  const totalStandardLoanDebt = ongoingMemberLoans.filter(t => t.type === "Permanent").reduce((t, l) => {
    const interestDue = LoansServiceManager.calculateCashInterestDueAmount(l, new Date(), member.points)?.totalInterestDue || 0;
    return t + (Number(l.principalLeft || 0) + Number(interestDue));
  }, 0);
  const totalFreeLoanDebt = ongoingMemberLoans.filter(t => t.type === "Permanent").reduce((t, l) => {
    const interestDue = LoansServiceManager.calculateCashInterestDueAmount(l, new Date(), member.points)?.totalInterestDue || 0;
    return t + (Number(l.principalLeft || 0) + Number(interestDue));
  }, 0);
  const thisYearMemberStandardLoansSum = thisYearMemberLoans.filter(t => t.type === "Standard").reduce((t, l) => t + (l.amount || 0), 0);
  const thisYearMemberFreeLoansSum = thisYearMemberLoans.filter(t => t.type === "Interest-Free").reduce((t, l) => t + (l.amount || 0), 0);
  const totalStandardLoansInterestDue = ongoingMemberLoans.filter(t => t.type === "Standard").reduce((t, l) => t + (LoansServiceManager.calculateCashInterestDueAmount(l, new Date(), member.points)?.totalInterestDue || 0), 0);
  const totalFreeLoansInterestDue = 0; //ongoingMemberLoans.filter(t => t.type === "Interest-Free").reduce((t, l) => t + (LoansServiceManager.calculateCashInterestDueAmount(l, new Date(), member.points)?.totalInterestDue || 0), 0);
  const totalStandardLoansEver = memberLoans.filter(t => t.type === "Standard").reduce((t, l) => t + (l.amount || 0), 0);
  const totalFreeLoansEver = memberLoans.filter(t => t.type === "Interest-Free").reduce((t, l) => t + (l.amount || 0), 0);

  // club totals
  const clubWorth = allMembers.reduce((s, m) => s + (m.permanentInvestment?.amount || 0), 0);
  const clubTemporarySavingsWorth = allMembers.reduce((s, m) => s + (m.temporaryInvestment?.amount || 0), 0);
  const clubDepositsArray = processArray(allDeposits.filter(t => t.type === "Permanent"), arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const thisYearClubDeposits = (clubDepositsArray?.yearsSums?.[currentYear]?.amount) || 0;
  const totalClubTemporarySavingsEver = allDeposits.filter(t => t.type === "Temporary").reduce((t, l) => t + (l.amount || 0), 0);
  const clubTemporaryDepositsArray = processArray(allDeposits.filter(t => t.type === "Temporary"), arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const thisYearTemporaryClubDeposits = (clubTemporaryDepositsArray?.yearsSums?.[currentYear]?.amount) || 0;
  const currentParticipants = allMembers.filter(m => m.temporaryInvestment?.amount !== 0);
  
  const clubEarningsArray = processArray(allEarnings.filter(t => t.source === "Permanent Savings"), arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  const thisYearClubEarnings = (clubEarningsArray?.yearsSums?.[currentYear]?.amount) || 0;

  const clubLoansArray = processArray(allLoans, arr => getTotalSumsAndSort(arr, 'date', 'amount'));
  
  const thisYearClubLoans = allThisYearLoans.filter(t => t.type === "Standard").reduce((t, l) => t + (l.amount || 0), 0);
  const totalFreeClubLoans = allLoans.filter(t => t.type === "Interest-Free").reduce((t, l) => t + (l.amount || 0), 0);

  //Limits and other figures
  const {loanMultiplier, loanLimit, interestPaidInLastYear} = await LoansServiceManager.calculateStandardLoanLimit(userId);

  //
  const largestContribution = memberDeposits.filter(t => t.type === "Temporary").reduce(
    (max, current) => (current.amount > max.amount ? current : max)
  );
  const requestedAmount = 0.4 * largestContribution;
  const temporaryLoanLimit = await LoansServiceManager.calculateFreeLoanEligibility(member, requestedAmount, 365);//Default is one year
  const savingsDays = Math.round(member.temporaryInvestment.units / member.temporaryInvestment.amount);
  
  
  // ---- savings categorization (map members -> totals, categorize, find user's category/rank) ----
  const memberTotalsMap = {};
  (allMembers || []).forEach(m => {
    // use permanentInvestment.amount as the member's savings/holding
    const id = (m._id || m.id || '').toString();
    memberTotalsMap[id] = (memberTotalsMap[id] || 0) + (m.permanentInvestment?.amount || 0);
  });

  // standings by range
  const standings = categorizeAmounts(memberTotalsMap, ACCOUNT_BALANCE_RANGES);
  // determine current member's category label
  const findCategoryLabel = (value) => {
    for (const r of ACCOUNT_BALANCE_RANGES) {
      if (value >= r.min && value <= r.max) return r.label;
    }
    return ACCOUNT_BALANCE_RANGES[ACCOUNT_BALANCE_RANGES.length - 1].label;
  };
  const memberAmount = member.permanentInvestment?.amount || 0;
  const memberCategoryLabel = findCategoryLabel(memberAmount);
  const categoryMembershipCount = (standings.find(s => s.range === memberCategoryLabel)?.count) || 0;

  // compute user's rank among members by amount (1 = highest)
  const sortedMembersByAmount = (allMembers || []).slice().sort((a,b) => (b.permanentInvestment?.amount || 0) - (a.permanentInvestment?.amount || 0));
  const userRank = sortedMembersByAmount.findIndex(m => (m._id || m.id || '').toString() === (member._id || member.id || '').toString());
  const userRankDisplay = userRank === -1 ? 'N/A' : (userRank + 1);

  // ---- build response with real values (no dummy strings) ----
  const user = member; // keep property name consistent in response

  const response = {
    user,
    dashboardAppearance: dashboardAppearance,
    home: {
      memberStats : [
        { title: "Your Worth", value: formatCurrency(member.permanentInvestment?.amount || 0) },
        { title: "Your Earnings", value: formatCurrency(totalEarnings) },
        { title: "Your Current Loans", value: formatCurrency(totalStandardLoanDebt) },
        { title: "Club Worth", value: formatCurrency(clubWorth) },
        { title: "Club Earnings (Total)", value: formatCurrency((allEarnings || []).reduce((s,e) => s + (e.amount || 0), 0)) },
        { title: "Your Points", value: `${Math.round(member.points || 0)} pts` },
      ],
      memberOverviewGroups : [
        {
          title: "Savings",
          rows: [
            ["Savings this year", formatCurrency(thisYearDepositsSum)],
            ["Avg. monthly savings", formatCurrency(Math.round(thisYearDepositsSum / Math.max(1, monthsPassedThisYear)))],
            ["Category", memberCategoryLabel],
            ["Your Category Membership", String(categoryMembershipCount)],
          ],
        },
        {
          title: "Earnings",
          rows: [
            ["Projected Earnings", formatCurrency(Math.round(0.15 * member.permanentInvestment.amount))],//replace later with more accurate calculations
            ["Your Percentage", `${(ownershipPercentage * 100).toFixed(2)}` + "%"],
            ["Avg. monthly earnings", formatCurrency(Math.round(0.0125 * member.permanentInvestment.amount))],
            ["Avg. annual earnings rate", memberUnits ? `${(((totalEarnings * memberUnits.length * 365) / totalMemberUnits) * 100).toFixed(2)}` + "%": "N/A"],
          ],
        },
        {
          title: "Loans",
          rows: [
            ["Loans this year", formatCurrency(thisYearMemberStandardLoansSum)],
            ["Current interest due", formatCurrency(totalStandardLoansInterestDue)],
            ["Loan limit", formatCurrency(loanLimit)],
            ["Loan Multiplier, (rate)", `${loanMultiplier}, (${((interestPaidInLastYear / member.permanentInvestment.amount) * 100).toFixed(2)}%)`
            ]],
        },
        {
          title: "Points",
          rows: [
            ["Total Points", String(Math.round(member.points || 0))],
            ["Points gained this year", String(pointsThisYearEarned)],
            ["Redeemed", String(totalPointsRedeemed)],
            ["Cash Equivalent", formatCurrency(pointsWorth)],
          ],
        },
        {
          title: "Club Figures",
          rows: [
            ["Savings this year", formatCurrency(thisYearClubDeposits)],
            ["Projected Earnings", formatCurrency(0.16 * clubWorth)],//update with accurate calculations
            ["Loans this year", formatCurrency(thisYearClubLoans)],
            ["Members", String((allMembers || []).length)],
          ],
        },
      ],
    },
    temporary: {
      memberStats : [
        { title: "Current Worth", value: formatCurrency(member.temporaryInvestment?.amount || 0) },
        { title: "Your Earnings", value: formatCurrency(totalSavingsEarnings || 0)},
        { title: "Your Current Loans", value: formatCurrency(totalFreeLoanDebt || 0) },
        { title: "Total Contributions", value: formatCurrency(clubTemporarySavingsWorth || 0) },
        { title: "Club Earnings (Total)", value: formatCurrency(([]).reduce((s,e) => s + (e.amount || 0), 0)) },  //allTemporarySavingsEarnings ||       
        { title: "Total Withdrawals", value: formatCurrency(([]).reduce((s,e) => s + (e.amount || 0), 0)) },
      ],
      memberOverviewGroups : [
        {
          title: "Savings",
          rows: [
            ["Total Contributions Ever", formatCurrency(totalTemporarySavingsEver)],
            ["Savings this year", formatCurrency(thisYearDepositsSum)],
            ["Largest Contribution", formatCurrency(largestContribution)],
            ["Current Savings Period", `${(savingsDays || 0)} Days`],
          ],
        },
        {
          title: "Loans",
          rows: [
            ["Loans this year", formatCurrency(thisYearMemberFreeLoansSum)],
            ["Loan limit Amount", formatCurrency(temporaryLoanLimit.loanLimit)],
            ["Loan limit Period", formatCurrency(temporaryLoanLimit.loanPeriodLimit)],
            ["Total Loans Ever", formatCurrency(totalFreeLoansEver)],
          ],
        },
        {
          title: "Club Figures",
          rows: [
            ["Total Contributions", formatCurrency(totalClubTemporarySavingsEver)],
            ["Total Loans issued", formatCurrency(totalFreeClubLoans)],
            ["Savings this year", formatCurrency(thisYearTemporaryClubDeposits)],
            ["Current Participants", String((currentParticipants || []).length)],
          ],
        },
      ],
    },

    // list views / year grouped records (reuse your formatters)
    memberDeposits: formatRecordsForYears(depositsProcessed, formatDate),
    memberTemporaryDeposits: formatRecordsForYears(temporarySavingsProcessed, formatDate),//combine with withdrawals and extra table column for transaction type
    memberEarnings: formatRecordsForYears(earningsProcessed, formatDate),
    memberSavingsEarnings: formatRecordsForYears(savingsEarningsProcessed, formatDate),
    clubDeposits: formatClubDeposits(clubDepositsArray),
    clubTemporaryFigures: formatClubDeposits(clubTemporaryDepositsArray),//combine with withdrawals, loans and extra table column for transaction type
    clubEarnings: formatClubEarnings(clubEarningsArray, /* clubUnits */ undefined),
    memberLoans: await buildMemberLoanRecords(memberLoans.filter(t => t.type === "Standard"), user, formatDate),
    ongoingMemberLoans: await buildMemberLoanRecords(ongoingMemberLoans.filter(t => t.type !== 'Ongoing'), user, formatDate),
    endedMemberLoans: await buildMemberLoanRecords(memberLoans.filter(t => t.status === 'Ended'), user, formatDate),
    memberFreeLoans: await buildMemberLoanRecords(memberLoans.filter(t => t.type === "Interest-Free"), user, formatDate),
    memberTemporarySavingsWithdrawals: [],

    // points: produce structured year-grouped lists from transactions
    pointsRecords:formatRecordsForYears(processArray(pointsTransactions, arr => getTotalSumsAndSort(arr, 'date', 'points')), formatDate),
    pointsSpent: formatRecordsForYears(processArray(pointsTransactions.filter(t => t.type === 'redeem'), arr => getTotalSumsAndSort(arr, 'date', 'points')), formatDate),
    pointsEarned: formatRecordsForYears(processArray(pointsTransactions.filter(t => t.type !== 'redeem'), arr => getTotalSumsAndSort(arr, 'date', 'points')), formatDate),

    // discounts not fetched above -> return empty array for now
    discounts: []
  };

  return response;
}

/* ----- small helper formatting functions (pure, testable) ----- */
function generateSavingsAccountStandings(userRecords) {
  const memberDepositTotalsById = {}; // Aggregate by ID
  const memberInfoMap = {};           // Map to store member's name

  userRecords.forEach(record => {
      const memberId = record._id.toString(); 
      const memberName = record.fullName;

      if (!memberDepositTotalsById[memberId]) {
        memberDepositTotalsById[memberId] = 0;
          memberInfoMap[memberId] = memberName;
      }
      memberDepositTotalsById[memberId] += record.permanentInvestment.amount;
  });

  const memberDepositTotals = Object.keys(memberDepositTotalsById).map(memberId => ({
      id: memberId,
      name: memberInfoMap[memberId],
      total: memberDepositTotalsById[memberId]
  }));

  const depositStandings = categorizeAmounts(memberDepositTotalsById, ACCOUNT_BALANCE_RANGES);

  return {
      standings: depositStandings,
      memberTotals: memberDepositTotals
  };
}

function formatRecordsForYears(processedObj, dateFormatter) {
  if (!processedObj || processedObj === 'No Data Available') return [];
  const entries = Object.entries(processedObj.yearsSums || {});
  // sort descending by year
  entries.sort((a, b) => b[0] - a[0]);
  return entries.map(([year, sum]) => {
    const records = processedObj.recordsByYear?.[year] || [];
    const values = records.map(r => [dateFormatter(r.date || r.date || r.date || r.date), Math.round(r.amount || r.points_involved || 0), r.source || r.reason || '']);
    const avg = year != new Date().getFullYear() ? Math.round(sum.amount / 12) : Math.round(sum.amount / (new Date().getMonth() + 1));
    return { year, total: Math.round(sum.amount || sum.points_involved || 0), avgMonthyDeposit: avg, values };
  });
}

function formatClubDeposits(clubDepositsArray) {
  if (!clubDepositsArray || clubDepositsArray === 'No Data Available') return [];

  return Object.entries(clubDepositsArray.yearsSums)
    .sort((a, b) => b[0] - a[0])
    .map(([year, sum]) => {
      const monthly = Object.entries(clubDepositsArray.monthlySums?.[year] || {}).map(([month, mRec]) => {
        // Robust retrieval of amount (supports different field names)
        const amount = Math.round(mRec.amount ?? mRec.deposit_amount ?? 0);

        // Robust retrieval of unique depositor count (savers). Try common keys, default 0.
        const saversRaw = mRec.depositors ?? mRec.savers ?? mRec.depositorCount ?? mRec.depositor_count ?? 0;
        const savers = Math.max(0, Math.round(Number(saversRaw || 0)));

        return [month, amount, savers];
      });

      const avg = year != new Date().getFullYear()
        ? Math.round((sum.amount ?? sum.deposit_amount ?? 0) / 12)
        : Math.round((sum.amount ?? sum.deposit_amount ?? 0) / (new Date().getMonth() + 1));

      return { year, total: Math.round(sum.amount ?? sum.deposit_amount ?? 0), avgMonthyDeposit: avg, values: monthly };
    });
}


function formatClubEarnings(clubEarningsArray, clubUnits) {
  if (!clubEarningsArray || clubEarningsArray === 'No Data Available') return [];
  console.log(clubEarningsArray);
  if (!clubUnits || clubUnits === 'No Data Available') return [];
  const out = [];
  Object.entries(clubEarningsArray.yearsSums).forEach(([year, rec]) => {
    const unitsRec = clubUnits.yearsSums?.[year];
    if (!unitsRec) return;
    const actualInvestment = unitsRec.units / 365;
    const roi = year != new Date().getFullYear() ? Math.round(rec.amount * 100 / actualInvestment) : 0;
    out.push([year, Math.round(rec.amount), roi]);
  });
  return out;
}

async function buildMemberLoanRecords(memberLoans, member, dateFormatter) {

  const loanRecordPromises = memberLoans.map(async record => {
    let memberInfo = member ? member : await getUserById(record.borrower._id);
    
    const paymentHistory = (record.payments || []).map(p => [dateFormatter(p.date), Math.round(p.amount)]);
    const interestDue = LoansServiceManager.calculateCashInterestDueAmount(record, new Date(), memberInfo.points)?.totalInterestDue
    const amountLeft = record.principalLeft + interestDue;

    return {
      loanId: record._id,
      borrower: record.borrower.fullName,
      issueDate: dateFormatter(record.date),
      loanAmount: record.amount,
      amountLeft,
      unclearedInterest: interestDue,
      paid_interest : Math.round(record.interestAmount),
      agreedLoanDuration: `${Math.round(record.duration)} months`,
      pointsSpent: Math.round(record.pointSpent || 0),
      loan_status: record.status,
      paymentHistory
    };
  });
  
  return await Promise.all(loanRecordPromises);
}

export async function createUser(user){
  Validator.schema(Schemas.createUser, user)
  user = _buildUser(user)
  const appearance = {
    userId: user._id,
    layout: "Layout 1",
    color: "gold"
  }
  await User.create(user)
  await Appearance.create(appearance)

  sendUserCreatedEmail(user, password)
}

export async function updateUser(userId, update){
  Validator.schema(Schemas.updateUser, {userId, update})
  await DB.transaction(async()=>{
    const user = await getUserById(userId)
    user.set(update)
    await user.save()
  })
}

export async function updateUserRestricted(userId, update){
  Validator.schema(Schemas.updateUserRestricted, {userId, update})
  await updateUser(userId, update)
}

export async function updateUserPhoto(userId, tempPhotoPath){
  Validator.schema(Schemas.updateUserPhoto, {userId, tempPhotoPath})
  let user
  try{
    user = await getUserById(userId)
  }
  catch(err){
    //remove uploaded photo if user was not found
    if (err instanceof Errors.NotFoundError){
      fs.unlink(tempPhotoPath, (err)=>{
        if(err) throw new Errors.InternalServerError("An error occured deleting uploaded photo", err);
      })
    }

    throw err
  }

  const currentTime = DateUtil.getToday().getTime()
  const fileName = `img/${user.fullName}-${currentTime}.jpg`;
  const permPhotoPath = path.join(publicDirectory, fileName);

  //move photo to the public directory
  try{
    fs.mkdirSync(path.dirname(permPhotoPath), { recursive: true });
    fs.renameSync(tempPhotoPath, permPhotoPath)
  }
  catch(err){
    throw new Errors.InternalServerError("An error occured saving photo",  err)
  }

  //save photo reference to database
  user.photoURL = fileName
  await user.save()
}

export async function deleteUserPhoto(userId){
  Validator.schema(Schemas.deleteUserPhoto, userId)
  const user = await getUserById(userId)
  if (!user.photoURL){
    throw new Errors.BadRequestError("Failed to delete photo, photo not found")
  }
  const fileName = user.photoURL
  const filePath = path.join(publicDirectory, fileName);
  try{
    fs.unlinkSync(filePath)
  }
  catch(err){
    throw new Errors.InternalServerError("An error occured deleting photo", err)
  }

  //update user
  user.photoURL = ""
  await user.save()
}

export async function addPoints(userId, points){
  Validator.schema(Schemas.addPoints, {userId, points})
  await DB.transaction(async()=>{
    const user = await getUserById(userId)
    if (user.points + points < 0) {
      throw new Errors.BadRequestError("Insufficient points balance")
    }

    await User.updateOne({_id: userId}, {$inc: {points}})
    })
}

export async function transferPoints(senderId, recipientId, points, reason){
  Validator.schema(Schemas.transferPoints, {senderId, recipientId, points, reason})
  await PointServiceManager.transferPoints(senderId, recipientId, points, reason)
}

export async function updatePermanentInvestment(userId, {deltaAmount, deltaUnits, newUnitsDate}){
  Validator.schema(Schemas.updatePermanentInvestment, {userId, update: {
    deltaAmount,
    deltaUnits,
    newUnitsDate,
  }})

  let update = {$set: {}, $inc: {}}
  if (newUnitsDate) update.$set["permanentInvestment.unitsDate"] = newUnitsDate
  if (deltaAmount) update.$inc["permanentInvestment.amount"] = deltaAmount
  if (deltaUnits) update.$inc["permanentInvestment.units"] = deltaUnits
  await DB.query(User.updateOne({_id: userId}, update))
}

export async function updateTemporaryInvestment(userId, {deltaAmount, deltaUnits, newUnitsDate}){
  Validator.schema(Schemas.updateTemporaryInvestment, {userId, update: {
    deltaAmount,
    deltaUnits,
    newUnitsDate
  }})

  let update = {$set: {}, $inc: {}}
  if (newUnitsDate) update.$set["temporaryInvestment.unitsDate"] = newUnitsDate
  if (deltaAmount) update.$inc["temporaryInvestment.amount"] = deltaAmount
  if (deltaUnits) update.$inc["temporaryInvestment.units"] = deltaUnits

  await DB.query(User.updateOne({_id: userId}, update))
}

export async function deleteUser(userId){
  Validator.schema(Schemas.deleteUser, userId)
  await DB.query(User.updateOne({_id: userId}, {
    $set: {
      isActive: false
    }
  }))
}

export async function sendUserCreatedEmail(user, password){
  EmailServiceManager.sendEmail({
    sender: "accounts",
    recipient: user.email,
    subject: "Account Created",
    message: `Dear ${user.fullName}, your growthspring account has been created successfuly. Your default login password is: ${password}`
  })
}

//helpers
function _buildUser(user){
  user = {
    ...user,
    _id: new mongoose.Types.ObjectId().toHexString(),
    membershipDate: DateUtil.getToday(),
    permanentInvestment: {
      amount: 0,
      units: 0,
      unitsDate: DateUtil.getToday()
    },
    temporaryInvestment: {
      amount: 0,
      units: 0,
      unitsDate: DateUtil.getToday()
    },
    points: 500,
    isActive: true,
  }

  return user
}

export async function getAdminDashboard(userId) {
  const filterAll = {};

  const [
    allDeposits,
    allLoans,
    allMembers,
  ] = await Promise.all([
    DepositServiceManager.getDeposits(filterAll),
    LoansServiceManager.getLoans(filterAll),
    getUsers(),
  ]);

  // ---------- Helpers ----------
  function safeNumber(v) {
    if (v === undefined || v === null) return 0;
    if (typeof v === "number" && !isNaN(v)) return v;
    const digits = String(v).replace(/[^\d.-]/g, "");
    const n = Number(digits);
    return isNaN(n) ? 0 : n;
  }

  function formatCurrency(amount) {
    const safe = Number(amount || 0);
    return "UGX " + Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(safe);
  }

  // Accept dd/mm/yyyy or ISO or Date; return ISO string for internal use or null
  function toISODate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) return value.toISOString();
    if (typeof value === "string") {
      const parts = value.split("/");
      if (parts.length === 3) {
        const [dRaw, mRaw, yRaw] = parts.map((p) => p.trim());
        const d = dRaw.padStart(2, "0");
        const m = mRaw.padStart(2, "0");
        const y = yRaw.length === 2 ? "20" + yRaw : yRaw;
        const isoCandidate = new Date(`${y}-${m}-${d}`); // yyyy-mm-dd
        if (!isNaN(isoCandidate)) return isoCandidate.toISOString();
      }
      const parsed = new Date(value); // try ISO
      if (!isNaN(parsed)) return parsed.toISOString();
    }
    return null;
  }

  // Format ISO string back to dd/mm/yyyy for display
  function displayDateFromISO(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  // processArray returns array (not string)
  function processArray(array, transformFn) {
    if (!Array.isArray(array) || array.length === 0) return [];
    return transformFn(array);
  }

  // Return totals + sorted items
  function getTotalSumsAndSort(arr = [], dateKey = "date", amountKey = "amount") {
    const items = (arr || []).map((it) => {
      const amountNum = safeNumber(it[amountKey]);
      const dateISO = toISODate(it[dateKey]) || null;
      return {
        ...it,
        [amountKey]: amountNum, // ensure numeric for totals
        dateISO,
      };
    });

    items.sort((a, b) => {
      const da = a.dateISO ? new Date(a.dateISO).getTime() : 0;
      const db = b.dateISO ? new Date(b.dateISO).getTime() : 0;
      return db - da;
    });

    const total = items.reduce((s, it) => s + safeNumber(it[amountKey]), 0);

    return {
      total,
      items,
    };
  }

  // ---------- Resolve location IDs to names (batch) ----------
  let locations = [];
  try {
    locations = await CashLocationServiceManager.getCashLocations();
  } catch (err) {
    // fail silently; locations remains an empty array
    locations = [];
  }

  function resolveLocationName(value) {
    if (!value) return null;
    // If value is an object with _id or id, try to match
    if (typeof value === "object") {
      const vid = String(value._id ?? value.id ?? "");
      const found = locations.find((l) => String(l._id) === vid || String(l.id) === vid);
      if (found) return found.name ?? found.locationName ?? found.displayName ?? vid;
      // fallback to known fields
      return value.name || value.location || vid || null;
    }
    // value is a string - try to find by id or by name
    const str = String(value);
    const foundById = locations.find((l) => String(l._id) === str || String(l.id) === str);
    if (foundById) return foundById.name ?? foundById.locationName ?? foundById.displayName ?? str;
    const foundByName = locations.find((l) => (l.name && String(l.name) === str) || (l.locationName && String(l.locationName) === str));
    if (foundByName) return foundByName.name ?? foundByName.locationName ?? foundByName.displayName ?? str;
    // fallback to returning the string itself
    return str;
  }

  // ---------- Build normalized records ----------

  const allRecords = [];

  // deposits
  for (const deposit of (allDeposits || [])) {
    const dateISO = toISODate(deposit.date);
    const amountNum = safeNumber(deposit.amount);
    allRecords.push({
      __amountNum: amountNum,
      __dateISO: dateISO,
      type: "Deposit",
      // returned/display fields
      amount: formatCurrency(amountNum),
      date: displayDateFromISO(dateISO) || (deposit.date || ""),
      name: deposit.depositor?.fullName || deposit.depositorName || "Unknown",
      destination: resolveLocationName(deposit.cashLocation) || "Not Available",
      notes: `${deposit.type || ""}${deposit.source ? ", " + deposit.source : ""}` || "None",
      isInflow: true,
      isOutflow: false,
    });
  }

  // loans and payments
  for (const loan of (allLoans || [])) {
    const loanDateISO = toISODate(loan.date);
    const loanAmountNum = safeNumber(loan.amount);

    // resolve sources -> string (do not await here; resolution done via locations array)
    let sourceStr = "Not Available";
    if (Array.isArray(loan.sources) && loan.sources.length) {
      sourceStr = loan.sources
        .filter((s) => safeNumber(s.amount) > 0)
        .map((s) => {
          const locVal = s.id;
          return resolveLocationName(locVal);
        })
        .filter(Boolean)
        .join(", ");
    } else {
      sourceStr = resolveLocationName(loan.source) || "Not Available";
    }

    allRecords.push({
      __amountNum: loanAmountNum,
      __dateISO: loanDateISO,
      type: "Loan Issued",
      amount: formatCurrency(loanAmountNum),
      date: displayDateFromISO(loanDateISO) || (loan.date || ""),
      name: loan.borrower?.fullName || "Unknown",
      source: sourceStr,
      isInflow: false,
      isOutflow: true,
    });

    for (const payment of (loan.payments || [])) {
      const payISO = toISODate(payment.date);
      const payAmountNum = safeNumber(payment.amount);
      allRecords.push({
        __amountNum: payAmountNum,
        __dateISO: payISO,
        type: "Loan Payment",
        amount: formatCurrency(payAmountNum),
        date: displayDateFromISO(payISO) || (payment.date || ""),
        name: loan.borrower?.fullName || payment.name || "Unknown",
        destination: resolveLocationName(payment.location) || "Not Available",
        isInflow: true,
        isOutflow: false,
      });
    }
  }

  // ---------- Sort using internal ISO date (descending) ----------
  allRecords.sort((a, b) => {
    const da = a.__dateISO ? new Date(a.__dateISO).getTime() : 0;
    const db = b.__dateISO ? new Date(b.__dateISO).getTime() : 0;
    return db - da;
  });

  // ---------- Group into months and compute numeric totals ----------
  const monthlyRecordsInternal = allRecords.reduce((acc, rec) => {
    const monthKey = rec.__dateISO
      ? new Date(rec.__dateISO).toLocaleString("default", { month: "long", year: "numeric" })
      : (rec.date || "Unknown");

    if (!acc[monthKey]) {
      acc[monthKey] = {
        records: [],
        totalInflow: 0,
        totalOutflow: 0,
        totalDeposits: 0,
        totalLoans: 0,
        totalLoanPayments: 0,
      };
    }

    // keep internal numbers in monthly structure, but put client-facing object in records array
    const clientRecord = {
      type: rec.type,
      amount: rec.amount,
      date: rec.date,
      name: rec.name,
      destination: rec.destination,
      source: rec.source,
      notes: rec.notes,
      isInflow: rec.isInflow,
      isOutflow: rec.isOutflow,
    };

    acc[monthKey].records.push({
      __amountNum: rec.__amountNum || 0,
      __dateISO: rec.__dateISO || null,
      returned: clientRecord,
      type: rec.type,
    });

    if (rec.isOutflow) acc[monthKey].totalOutflow += Number(rec.__amountNum || 0);
    else acc[monthKey].totalInflow += Number(rec.__amountNum || 0);

    if (rec.type === "Deposit") acc[monthKey].totalDeposits += Number(rec.__amountNum || 0);
    else if (rec.type === "Loan Issued") acc[monthKey].totalLoans += Number(rec.__amountNum || 0);
    else if (rec.type === "Loan Payment") acc[monthKey].totalLoanPayments += Number(rec.__amountNum || 0);

    return acc;
  }, {});

  // ---------- Format monthly records for response ----------
  const formattedMonthlyRecords = {};
  for (const [month, data] of Object.entries(monthlyRecordsInternal)) {
    formattedMonthlyRecords[month] = {
      totalInflow: formatCurrency(data.totalInflow),
      totalOutflow: formatCurrency(data.totalOutflow),
      totalDeposits: formatCurrency(data.totalDeposits),
      totalLoans: formatCurrency(data.totalLoans),
      totalLoanPayments: formatCurrency(data.totalLoanPayments),
      records: (data.records || []).map((r) => r.returned),
    };
  }

  function formatDate(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  // overall totals
  const totalInflow = Object.values(monthlyRecordsInternal).reduce((s, m) => s + (m.totalInflow || 0), 0);
  const totalOutflow = Object.values(monthlyRecordsInternal).reduce((s, m) => s + (m.totalOutflow || 0), 0);
  const netFlow = totalInflow - totalOutflow;

  // Build response
  const response = {
    adminOverview: {
      monthlySummaries: formattedMonthlyRecords,
      totals: {
        totalInflow: formatCurrency(totalInflow),
        totalOutflow: formatCurrency(totalOutflow),
        netFlow: formatCurrency(netFlow),
      },
    },
    allDeposits: processArray(allDeposits, (arr) => getTotalSumsAndSort(arr, "date", "amount")),
    allUsers: allMembers.map(m => m.fullName),
    allLoans: await buildMemberLoanRecords(allLoans, "", formatDate),
  };

  return response;
}
