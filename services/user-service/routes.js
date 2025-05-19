import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.get(
  "/",
  RouteController.getUsers
)
router.get(
  "/:id",
  RouteController.getUser
)
router.post(
  "/",
  RouteController.createUser
)
router.put(
  "/:id",
  RouteController.updateUser
)
router.delete(
  "/:id",
  RouteController.deleteUser
)

export default router