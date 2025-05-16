import express from "express"

import RouteController  from "./controller.js"
import ServiceManager from "./service.js"
import { Withdraw } from "./models.js"

const serviceManager = new ServiceManager(Withdraw)
const routeController = new RouteController(serviceManager)

const router = express.Router()

router.get(
  "/",
  (req, res, next)=> routeController.getWithdraws(req, res, next)
)
router.get(
  "/:id",
  (req, res, next)=> routeController.getWithdraw(req, res, next)
)
router.post(
  "/",
  (req, res, next)=> routeController.createWithdraw(req, res, next)
)
router.put(
  "/:id",
  (req, res, next)=> routeController.updateWithdraw(req, res, next)
)
router.delete(
  "/:id",
  (req, res, next)=> routeController.deleteWithdraw(req, res, next)
)

export default router