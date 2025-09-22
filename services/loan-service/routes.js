import express from "express";

import * as RouteController from "./controller.js";
import { requireUser, requireAdmin } from "../../middleware.js";

const router = express.Router();

router.use(requireUser);
router.use(requireAdmin);

// General requests
router.get("/", RouteController.getLoans);
router.get("/:id", RouteController.getLoanById);
router.get("/:id/payments", RouteController.getLoanPayments);
router.get("/:id/payments/:paymentId", RouteController.getLoanPayment);
router.post("/initiate", RouteController.initiateLoan);
router.post("/approve/:id", RouteController.approveLoan);
router.post("/cancel/:id", RouteController.cancelLoanRequest);
router.post("/payment/:id", RouteController.processLoanPayment);

// General helper functions
router.post("/calculate-total-months-due", RouteController.calculateTotalMonthsDue);
router.post("/calculate-point-months-accrued", RouteController.calculatePointMonthsAccrued);

// Standard loan functions
router.get("/standard/limit/:borrowerId", RouteController.calculateStandardLoanLimit);

// Functions to determine interest charged in a specific period
router.post("/aggregated-loan-interest-by-period", RouteController.getAggregatedLoanInterestByPeriod);
router.post("/loan-effective-end-date", RouteController.getLoanEffectiveEndDate);

// Loan limit multiplier
router.post("/limit-multiplier", RouteController.getLimitMultiplier);

// Helper functions for standard loan payments
router.post("/standard/principal-paid", RouteController.calculateStandardLoanPrincipalPaid);
router.post("/total-interest-due-amount", RouteController.calculateTotalInterestDueAmount);
router.post("/cash-interest-due-amount", RouteController.calculateCashInterestDueAmount);
router.post("/points-consumed", RouteController.calculatePointsConsumed);
router.post("/points-interest-due-amount", RouteController.calculatePointsInterestDueAmount);
router.post("/points-months-due", RouteController.calculatePointsMonthsDue);

// Temporary loans (Interest-Free)
router.post("/interest-free/eligibility", RouteController.calculateFreeLoanEligibility);
router.post("/interest-free/principle-left", RouteController.calculateFreeLoanPrincipleLeft);
router.post("/interest-free/overdue-metrics", RouteController.calculateFreeLoanOverdueMetrics);

export default router;