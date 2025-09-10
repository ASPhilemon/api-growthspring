import express from "express"

import * as RouteController  from "./controller.js"
import { requireAdmin } from "../../middleware.js"

const router = express.Router()

router.use(requireAdmin)

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
  RouteController.updateWithdraw
)
router.delete(
  "/:id",
  RouteController.deleteWithdraw
)

export default router