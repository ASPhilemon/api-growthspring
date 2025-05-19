import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.get(
  "/",
  RouteController.getWithdraws
)
router.get(
  "/:id",
  RouteController.getWithdraw
)
router.post(
  "/",
  RouteController.createWithdraw
)
router.put(
  "/:id",
  RouteController.updateWithdraw
)
router.delete(
  "/:id",
  RouteController.deleteWithdraw
)

export default router