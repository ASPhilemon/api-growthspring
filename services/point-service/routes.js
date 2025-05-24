import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

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