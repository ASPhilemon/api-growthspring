import express from "express"

import RouteController  from "./controller.js"
import ServiceManager from "./service.js"
import { User } from "./models.js"

const serviceManager = new ServiceManager(User)
const routeController = new RouteController(serviceManager)

const router = express.Router()

router.get(
  "/",
  (req, res, next)=> routeController.getUsers(req, res, next)
)
router.get(
  "/:id",
  (req, res, next)=> routeController.getUser(req, res, next)
)
router.post(
  "/",
  (req, res, next)=> routeController.createUser(req, res, next)
)
router.put(
  "/:id",
  (req, res, next)=> routeController.updateUser(req, res, next)
)
router.delete(
  "/:id",
  (req, res, next)=> routeController.deleteUser(req, res, next)
)

export default router