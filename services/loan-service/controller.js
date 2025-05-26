

import * as ServiceManager from "./service.js";
import * as Response from "../../utils/http-response-util.js";

export async function getLoans(req, res) {
  try {
    const { filter, sort, pagination } = req.query;
    const loans = await ServiceManager.getLoans({ filter, sort, pagination }); 
    Response.sendSuccess(res, loans);
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function getLoanById(req, res) {
  try {
    const { id: loanId } = req.params;
    const loan = await ServiceManager.getLoanById(loanId);
    Response.sendSuccess(res, loan);
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function initiateLoanRequest(req, res) {
  try {
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
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function approveLoan(req, res) {
  try {
    const { id: loanId } = req.params;
    const { sources } = req.body;
    
    const approvedLoan = await ServiceManager.approveLoan(loanId, req.user, sources);
    Response.sendSuccess(res, approvedLoan);
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function closeLoan(req, res) {
  try {
    const { id: loanId } = req.params;
    const closedLoan = await ServiceManager.closeLoan(loanId);
    Response.sendSuccess(res, closedLoan);
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function cancelLoanRequest(req, res) {
  try {
    const { id: loanId } = req.params;
    const result = await ServiceManager.cancelLoanRequest(loanId);
    Response.sendSuccess(res, result); 
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function deleteLoanPermanently(req, res) {
  try {
    const { id: loanId } = req.params;
    const result = await ServiceManager.deleteLoanPermanently(loanId);
    Response.sendSuccess(res, result); 
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function getLoanPayments(req, res) {
  try {
    const { loanId } = req.params; 
    const payments = await ServiceManager.getLoanPayments(loanId);
    Response.sendSuccess(res, payments);
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function getLoanPayment(req, res) {
  try {
    const { loanId, paymentId } = req.params; 
    const payment = await ServiceManager.getLoanPayment(loanId, paymentId);
    Response.sendSuccess(res, payment);
  } catch (error) {
    Response.sendError(res, error);
  }
}

export async function makeLoanPayment(req, res) {
  try {
    const { id: loanId } = req.params; 
    const { payment_amount, payment_date, payment_cash_location_id } = req.body; 
    const result = await ServiceManager.makeLoanPayment(
      loanId,
      payment_amount,
      payment_date,
      payment_cash_location_id,
      req.user // Pass current user
    );
    Response.sendSuccess(res, result); // Service returns msg and loan_status
  } catch (error) {
    Response.sendError(res, error);
  }
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
  try {
    const { loanId, paymentId } = req.params;
    const result = await ServiceManager.deleteLoanPayment(
      loanId,
      paymentId,
      req.user // Pass current user
    );
    Response.sendSuccess(res, result);
  } catch (error) {
    Response.sendError(res, error);
  }
}