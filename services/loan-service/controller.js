import * as ServiceManager from "./service.js";
import * as Response from "../../utils/http-response-util.js";
import * as UserServiceManager from "../user-service/service.js";

export async function getLoans(req, res) {
  let { borrowerId, status, type, year, month, sortBy, sortOrder, page, perPage } = req.query;
  let filter = {
    "borrower.id": borrowerId,
    status,
    type,
    year: Number(year) || undefined,
    month: Number(month) || undefined
  };
  // Remove undefined properties from filter
  Object.keys(filter).forEach(key => filter[key] === undefined && delete filter[key]);
  let sort = {
    field: sortBy,
    order: Number(sortOrder) || undefined
  };
  let pagination = {
    page: Number(page) || undefined,
    perPage: Number(perPage) || undefined
  };
  const loans = await ServiceManager.getLoans({ filter, sort, pagination });
  Response.sendSuccess(loans, { req, res });
}

export async function getLoanById(req, res) {
  const { id: loanId } = req.params;
  const loan = await ServiceManager.getLoanById(loanId);
  Response.sendSuccess(loan, { req, res });
}

export async function getLoanPayments(req, res) {
  const { id: loanId } = req.params;
  const payments = await ServiceManager.getLoanPayments(loanId);
  Response.sendSuccess(payments, { req, res });
}

export async function getLoanPayment(req, res) {
  const { id: loanId, paymentId } = req.params;
  const payment = await ServiceManager.getLoanPayment(loanId, paymentId);
  Response.sendSuccess(payment, { req, res });
}

export async function initiateLoan(req, res) {
  const { amount, duration, earliestDate, borrowerId, loanType, comment } = req.body;
  const currentUser = req.user;

  const createdLoan = await ServiceManager.initiateLoan(
    amount,
    duration,
    earliestDate,
    borrowerId,
    currentUser,
    loanType, 
    comment
  );
  Response.sendSuccess(createdLoan, { req, res });
}

export async function approveLoan(req, res) {
  const { id: loanId } = req.params;
  const { sources } = req.body;
  const approvedBy = req.user;
  const updatedLoan = await ServiceManager.approveLoan(loanId, approvedBy, sources);
  Response.sendSuccess(updatedLoan, { req, res });
}

export async function cancelLoanRequest(req, res) {
  const { id: loanId } = req.params;
  const result = await ServiceManager.cancelLoanRequest(loanId);
  Response.sendSuccess(result, { req, res });
}

export async function processLoanPayment(req, res) {
  const { id: loanId } = req.params;
  const { paymentAmount, cashLocationId, paymentDate } = req.body;
  const currentUser = req.user;
  const result = await ServiceManager.processLoanPayment(loanId, paymentAmount, cashLocationId, currentUser, new Date(paymentDate));
  Response.sendSuccess(result, { req, res });
}

export async function calculateTotalMonthsDue(req, res) {
  const { startDate, endDate } = req.body;
  const result = ServiceManager.calculateTotalMonthsDue(new Date(startDate), new Date(endDate));
  Response.sendSuccess(result, { req, res });
}

export async function calculatePointMonthsAccrued(req, res) {
  const { loanStartDate, calculationEndDate } = req.body;
  const result = ServiceManager.calculatePointMonthsAccrued(new Date(loanStartDate), new Date(calculationEndDate));
  Response.sendSuccess(result, { req, res });
}

export async function calculateStandardLoanLimit(req, res) {
  const { borrowerId } = req.params;
  const limit = await ServiceManager.calculateStandardLoanLimit(borrowerId);
  Response.sendSuccess(limit, { req, res });
}

export async function getAggregatedLoanInterestByPeriod(req, res) {
  const { memberIds, periodStart, periodEnd } = req.body;
  const interest = await ServiceManager.getAggregatedLoanInterestByPeriod({
    memberIds,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd)
  });
  Response.sendSuccess(interest, { req, res });
}

export async function getLoanEffectiveEndDate(req, res) {
  const { loanId, currentCalculationDate } = req.body;
  const loan = await ServiceManager.getLoanById(loanId);
  const result = ServiceManager.getLoanEffectiveEndDate(loan, new Date(currentCalculationDate));
  Response.sendSuccess(result, { req, res });
}

export async function getLimitMultiplier(req, res) {
  const { interestPaid, currentSavings } = req.body;
  const multiplier = ServiceManager.getLimitMultiplier(interestPaid, currentSavings);
  Response.sendSuccess(multiplier, { req, res });
}

export async function calculateStandardLoanPrincipalPaid(req, res) {
  const { paymentAmount, totalInterestDue, principalLeft } = req.body;
  const distribution = ServiceManager.calculateStandardLoanPrincipalPaid(paymentAmount, totalInterestDue, principalLeft);
  Response.sendSuccess(distribution, { req, res });
}

export async function calculateTotalInterestDueAmount(req, res) {
  const { amount, startDate, dueDate } = req.body;
  const interest = ServiceManager.calculateTotalInterestDueAmount(amount, new Date(startDate), new Date(dueDate));
  Response.sendSuccess(interest, { req, res });
}

export async function calculateCashInterestDueAmount(req, res) {
  const { loanId, dueDate, availablePoints } = req.body;
  const loan = await ServiceManager.getLoanById(loanId);
  const result = ServiceManager.calculateCashInterestDueAmount(loan, new Date(dueDate), availablePoints);
  Response.sendSuccess(result, { req, res });
}

export async function calculatePointsConsumed(req, res) {
  const { pointsInterestDueAmount } = req.body;
  const points = ServiceManager.calculatePointsConsumed(pointsInterestDueAmount);
  Response.sendSuccess(points, { req, res });
}

export async function calculatePointsInterestDueAmount(req, res) {
  const { loanId, availablePoints, dueDate } = req.body;
  const loan = await ServiceManager.getLoanById(loanId);
  const interest = ServiceManager.calculatePointsInterestDueAmount(loan, availablePoints, new Date(dueDate));
  Response.sendSuccess(interest, { req, res });
}

export async function calculatePointsMonthsDue(req, res) {
  const { loanStartDate, lastPaymentDate, currentDueDate } = req.body;
  const months = ServiceManager.calculatePointsMonthsDue(
    new Date(loanStartDate),
    new Date(lastPaymentDate),
    new Date(currentDueDate)
  );
  Response.sendSuccess(months, { req, res });
}

export async function calculateFreeLoanEligibility(req, res) {
  const { userId, requestedAmount, requestedPeriod } = req.body;
  const user = await UserServiceManager.getUserById(userId); 
  const eligibility = ServiceManager.calculateFreeLoanEligibility(user, requestedAmount, requestedPeriod);
  Response.sendSuccess(eligibility, { req, res });
}

export async function calculateFreeLoanPrincipleLeft(req, res) {
  const { userId, loanId, paymentAmount, paymentDate } = req.body;
  const user = await UserServiceManager.getUserById(userId);
  const loan = await ServiceManager.getLoanById(loanId);
  const result = await ServiceManager.calculateFreeLoanPrincipleLeft(user, loan, paymentAmount, new Date(paymentDate));
  Response.sendSuccess(result, { req, res });
}

export async function calculateFreeLoanOverdueMetrics(req, res) {
  const { loanId, userId, paymentDate } = req.body;
  const loan = await ServiceManager.getLoanById(loanId);
  const user = await UserServiceManager.getUserById(userId);
  const metrics = await ServiceManager.calculateFreeLoanOverdueMetrics(loan, user, new Date(paymentDate));
  Response.sendSuccess(metrics, { req, res });
}