import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.get(
  "/",
  RouteController.getWithdraws
)
router.get(
  "/:id",
  RouteController.getWithdrawById
)
router.post(
  "/",
  RouteController.recordWithdraw
)
router.put(
  "/:id",
  RouteController.updateWithdrawAmount
)
router.delete(
  "/:id",
  RouteController.deleteWithdraw
)

export default router