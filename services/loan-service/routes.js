import express from "express"

import RouteController  from "./controller.js"
import ServiceManager from "./service.js"
import { Loan, LoanPayment } from "./models.js"

const serviceManager = new ServiceManager(Loan, LoanPayment)
const routeController = new RouteController(serviceManager)

const router = express.Router()
const loanPaymentRouter = express.Router()

//loan payment routes
loanPaymentRouter.get(
  "/",
  (req, res, next)=> routeController.getLoanPayments(req, res, next)
)
loanPaymentRouter.get(
  "/:id",
  (req, res, next)=> routeController.getLoanPayment(req, res, next)
)
loanPaymentRouter.post(
  "/",
  RouteController.makeLoanPayment
)
loanPaymentRouter.delete(
  "/:id",
  (req, res, next)=> routeController.deleteLoanPayment(req, res, next)
)

//register loan payment routes
router.use("/payments", loanPaymentRouter)

//loan routes
router.get(
  "/",
  (req, res, next)=> routeController.getLoans(req, res, next)
)
router.get(
  "/:id",
  RouteController.getLoanById
)
router.post(
  "/",
  (req, res, next)=> routeController.createLoan(req, res, next)
)
router.put(
  "/:id/approve",
  (req, res, next)=> routeController.approveLoan(req, res, next)
)
router.put(
  "/:id/close",
  (req, res, next)=> routeController.closeLoan(req, res, next)
)
router.delete(
  "/:id",
  (req, res, next)=> routeController.deleteLoan(req, res, next)
)


export default router