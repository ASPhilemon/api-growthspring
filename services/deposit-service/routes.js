import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.get(
  "/", 
  RouteController.getDeposits
)
router.get(
  "/:id", 
  RouteController.getDeposit
)
router.post(
  "/", 
  RouteController.createDeposit
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