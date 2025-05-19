import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()
const loanPaymentRouter = express.Router()

//loan payment routes
loanPaymentRouter.get(
  "/",
  RouteController.getLoanPayments
)
loanPaymentRouter.get(
  "/:id",
  RouteController.getLoanPayment
)
loanPaymentRouter.post(
  "/",
  RouteController.createLoanPayment
)
loanPaymentRouter.put(
  "/:id",
  RouteController.updateLoanPayment
)

loanPaymentRouter.delete(
  "/:id",
  RouteController.deleteLoanPayment
)

//register loan payment routes
router.use("/payments", loanPaymentRouter)

//loan routes
router.get(
  "/",
  RouteController.getLoans
)
router.get(
  "/:id",
  RouteController.getLoan
)
router.post(
  "/",
  RouteController.createLoan
)
router.put(
  "/:id/approve",
  RouteController.approveLoan
)
router.put(
  "/:id/close",
  RouteController.closeLoan
)
router.delete(
  "/:id",
  RouteController.deleteLoan
)


export default router