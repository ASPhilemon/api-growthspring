import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()
const cashLocationTransferRouter = express.Router()

// cash location transfers routes
cashLocationTransferRouter.get(
  "/",
  RouteController.getTransfers
)
cashLocationTransferRouter.get(
  "/:id",
  RouteController.getTransferById
)
cashLocationTransferRouter.post(
  "/", 
  RouteController.recordTransfer
)
cashLocationTransferRouter.put(
  "/:id", 
  RouteController.updateTransferAmount
)
cashLocationTransferRouter.delete(
  "/:id",
  RouteController.deleteTransfer
)

//register cash location transfers routes
router.use("/transfers", cashLocationTransferRouter)


//cash location routes
router.get(
  "/",
  RouteController.getCashLocations
)
router.get(
  "/:id",
  RouteController.getCashLocationById
)
router.post(
  "/",
  RouteController.createCashLocation
)
router.put(
  "/:id",
  RouteController.setCashLocationAmount
)
router.delete(
  "/:id",
  RouteController.deleteCashLocation
)

export default router