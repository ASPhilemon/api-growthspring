

import * as ServiceManager from "./service.js";
import * as Response from "../../utils/http-response-util.js";

export async function getLoans(req, res) {
    const { filter, sort, pagination } = req.query;
    const loans = await ServiceManager.getLoans({ filter, sort, pagination }); 
    Response.sendSuccess(res, loans);
}

export async function getLoanById(req, res) {
    const { id: loanId } = req.params;
    const loan = await ServiceManager.getLoanById(loanId);
    Response.sendSuccess(res, loan);
  }

export async function initiateLoan(req, res) {
    const { loan_amount, loan_duration, earliest_date, latest_date, borrower_id } = req.body;
    
    const initiatedLoan = await ServiceManager.initiateLoanRequest(
      loan_amount,
      loan_duration,
      earliest_date,
      latest_date,
      borrower_id,
      req.user 
    );
    Response.sendSuccess(res, initiatedLoan);
}

export async function approveLoan(req, res) {
    const { id: loanId } = req.params;
    const { sources } = req.body;
    
    const approvedLoan = await ServiceManager.approveLoan(loanId, req.user, sources);
    Response.sendSuccess(res, approvedLoan);
}

export async function closeLoan(req, res) {
    const { id: loanId } = req.params;
    const closedLoan = await ServiceManager.closeLoan(loanId);
    Response.sendSuccess(res, closedLoan);
}

export async function cancelLoanRequest(req, res) {
    const { id: loanId } = req.params;
    const result = await ServiceManager.cancelLoanRequest(loanId);
    Response.sendSuccess(res, result);
}

export async function deleteLoanPermanently(req, res) {
    const { id: loanId } = req.params;
    const result = await ServiceManager.deleteLoanPermanently(loanId);
    Response.sendSuccess(res, result); 
}

export async function getLoanPayments(req, res) {
    const { loanId } = req.params; 
    const payments = await ServiceManager.getLoanPayments(loanId);
    Response.sendSuccess(res, payments);
}

export async function getLoanPayment(req, res) {
    const { loanId, paymentId } = req.params; 
    const payment = await ServiceManager.getLoanPayment(loanId, paymentId);
    Response.sendSuccess(res, payment);
}

export async function makeLoanPayment(req, res) {
    const { id: loanId } = req.params; 
    const { payment_amount, payment_date, payment_cash_location_id } = req.body; 
    const result = await ServiceManager.makeLoanPayment(
      loanId,
      payment_amount,
      payment_date,
      payment_cash_location_id,
      req.user // Pass current user
    );
    Response.sendSuccess(res, result); 
}

/*export async function updateLoanPayment(req, res) {
  try {
    const { loanId, paymentId } = req.params;
    const { update } = req.body; // Assuming update data is under 'update' key
    const result = await ServiceManager.updateLoanPayment(
      loanId,
      paymentId,
      update,
      req.user // Pass current user
    );
    Response.sendSuccess(res, result);
  } catch (error) {
    Response.sendError(res, error);
  }
}*/

export async function deleteLoanPayment(req, res) {
    const result = await ServiceManager.deleteLoanPayment(
      loanId,
      paymentId,
      req.user // Pass current user
    );
    Response.sendSuccess(res, result);
}