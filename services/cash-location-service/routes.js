import express from "express"

import RouteController  from "./controller.js"
import ServiceManager from "./service.js"
import { CashLocation, CashLocationTransfer } from "./models.js"

const serviceManager = new ServiceManager(CashLocation, CashLocationTransfer)
const routeController = new RouteController(serviceManager)

const router = express.Router()
const cashLocationTransferRouter = express.Router()

// cash location transfers routes
cashLocationTransferRouter.get(
  "/",
  (req, res, next)=> routeController.getCashLocationTransfers(req, res, next)
)
cashLocationTransferRouter.get(
  "/:id",
  (req, res, next)=> routeController.getCashLocationTransfer(req, res, next)
)
cashLocationTransferRouter.post(
  "/",
  (req, res, next)=> routeController.createCashLocationTransfer(req, res, next)
)
cashLocationTransferRouter.put(
  "/:id", 
  (req, res, next)=> routeController.updateCashLocationTransfer(req, res, next)
)
cashLocationTransferRouter.delete(
  "/:id",
  (req, res, next)=> routeController.deleteCashLocationTransfer(req, res, next)
)

//register cash location transfers routes
router.use("/transfers", cashLocationTransferRouter)


//cash location routes
router.get(
  "/",
  (req, res, next)=> routeController.getCashLocations(req, res, next)
)
router.get(
  "/:id",
  (req, res, next)=> routeController.getCashLocation(req, res, next)
)
router.post(
  "/",
  (req, res, next)=> routeController.createCashLocation(req, res, next)
)
router.put(
  "/:id",
  (req, res, next)=> routeController.updateCashLocation(req, res, next)
)
router.delete(
  "/:id",
  (req, res, next)=> routeController.deleteCashLocation(req, res, next)
)


export default router