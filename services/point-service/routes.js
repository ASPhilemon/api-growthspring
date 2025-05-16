import express from "express"

import RouteController  from "./controller.js"
import ServiceManager from "./service.js"
import { PointTransfer } from "./models.js"

const serviceManager = new ServiceManager(PointTransfer)
const routeController = new RouteController(serviceManager)

const router = express.Router()

router.get(
  "/",
  (req, res, next)=> routeController.getPointTransfers(req, res, next)
)
router.get(
  "/:id",
  (req, res, next)=> routeController.getPointTransfer(req, res, next)
)
router.post(
  "/",
  (req, res, next)=> routeController.createPointTransfer(req, res, next)
)
router.put(
  "/:id",
  (req, res, next)=> routeController.updatePointTransfer(req, res, next)
)
router.delete(
  "/:id",
  (req, res, next)=> routeController.deletePointTransfer(req, res, next)
)

export default router