import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.get(
  "/",
  RouteController.getPointTransfers
)
router.get(
  "/:id",
  RouteController.getPointTransfer
)
router.post(
  "/",
  RouteController.createPointTransfer
)
router.put(
  "/:id",
  RouteController.updatePointTransfer
)
router.delete(
  "/:id",
  RouteController.deletePointTransfer
)

export default router