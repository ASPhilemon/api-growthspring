import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.get(
  "/", 
  RouteController.getDeposits
)
router.get(
  "/club-deposits", 
  RouteController.getClubDeposits
)
router.get(
  "/:id", 
  RouteController.getDeposit
)
router.post(
  "/", 
  RouteController.recordDeposit
)
router.put(
  "/:id", 
  RouteController.setDepositAmount
)
router.delete(
  "/:id", 
  RouteController.deleteDeposit
)


export default router