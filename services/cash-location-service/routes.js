import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()
const cashLocationTransferRouter = express.Router()

import { requireUser, requireAdmin } from "../../middleware.js"

router.use(requireUser)
router.use(requireAdmin)
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
  RouteController.updateTransfer
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

router.put(
  "/:id",
  RouteController.updateCashLocation
)

export default router