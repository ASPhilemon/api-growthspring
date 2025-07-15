import express from "express"

import * as RouteController  from "./controller.js"
import { requireUser, requireAdmin } from "../../middleware.js"

const router = express.Router()

router.use(requireUser)
router.use(requireAdmin)

router.get(
  "/", 
  RouteController.getDeposits
)
router.get(
  "/yearly-deposits", 
  RouteController.getYearlyDeposits
)
router.get(
  "/:id", 
  RouteController.getDepositById
)
router.post(
  "/", 
  RouteController.recordDeposit
)
router.put(
  "/:id", 
  RouteController.updateDeposit
)
router.delete(
  "/:id", 
  RouteController.deleteDeposit
)

export default router