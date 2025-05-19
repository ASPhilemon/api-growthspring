import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()
const cashLocationTransferRouter = express.Router()

// cash location transfers routes
cashLocationTransferRouter.get(
  "/",
  RouteController.getCashLocationTransfers
)
cashLocationTransferRouter.get(
  "/:id",
  RouteController.getCashLocationTransfer
)
cashLocationTransferRouter.post(
  "/", 
  RouteController.createCashLocationTransfer
)
cashLocationTransferRouter.put(
  "/:id", 
  RouteController.updateCashLocationTransfer
)
cashLocationTransferRouter.delete(
  "/:id",
  RouteController.deleteCashLocationTransfer
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
  RouteController.getCashLocation
)
router.post(
  "/",
  RouteController.createCashLocation
)
router.put(
  "/:id",
  RouteController.updateCashLocation
)
router.delete(
  "/:id",
  RouteController.deleteCashLocation
)


export default router