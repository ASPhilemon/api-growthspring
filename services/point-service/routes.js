import express from "express"

import * as RouteController  from "./controller.js"

import { requireAdmin } from "../../middleware.js"

const router = express.Router()

router.use(requireAdmin)

router.get(
  "/",
  RouteController.getTransactions
)
router.get(
  "/:id",
  RouteController.getTransactionById
)
router.post(
  "/",
  RouteController.recordTransaction
)
router.put(
  "/:id",
  RouteController.updateTransaction
)
router.delete(
  "/:id",
  RouteController.deleteTransaction
)

export default router