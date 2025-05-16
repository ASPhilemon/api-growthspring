import express from "express"

import RouteController  from "./controller.js"
import ServiceManager from "./service.js"
import { Deposit } from "./models.js"

const serviceManager = new ServiceManager(Deposit)
const routeController = new RouteController(serviceManager)

const router = express.Router()

router.get(
  "/",
  (req, res, next)=> routeController.getDeposits(req, res, next)
)
router.get(
  "/:id",
  (req, res, next)=> routeController.getDeposit(req, res, next)
)
router.post(
  "/",
  (req, res, next)=> routeController.createDeposit(req, res, next)
)
router.put(
  "/:id",
  (req, res, next)=> routeController.updateDeposit(req, res, next)
)
router.delete(
  "/:id",
  (req, res, next)=> routeController.deleteDeposit(req, res, next)
)

export default router