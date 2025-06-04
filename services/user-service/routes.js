import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.get(
  "/me",
  RouteController.getMe
)

router.get(
  "/me/dashboard",
  RouteController.getMyDashboard
)

router.put(
  "/me",
  RouteController.updateMe
)

router.delete(
  "/me",
  RouteController.deleteMe
)


//admin only
router.get(
  "/",
  RouteController.getUsers
)

router.get(
  "/:id",
  RouteController.getUserById
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