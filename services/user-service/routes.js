import path from "path"
import express from "express"
import multer from "multer"
import * as RouteController  from "./controller.js"

import { requireUser, requireAdmin } from "../../middleware.js"

const router = express.Router()

//multer set up
const moduleDirectory = import.meta.dirname
const uploadsDirectory = path.join(moduleDirectory, "..", "..", "uploads")
const upload = multer({ dest: uploadsDirectory });
const multerMiddleware = upload.single('image')

router.use(requireUser)
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
  upload.single('image'),
  RouteController.updateMe
)
router.put(
  "/me/photo",
  multerMiddleware,
  RouteController.updateMyPhoto
)
router.delete(
  "/me/photo",
  multerMiddleware,
  RouteController.deleteMyPhoto
)
router.post(
  "/me/point-transactions",
  RouteController.transferPoints
)

//admin only
router.use(requireAdmin)
router.get(
  "/",
  RouteController.getUsers
)
router.get(
  "/:id",
  RouteController.getUserById
)
router.get(
  "/:id/dashbord",
  RouteController.getUserDashboard
)
router.post(
  "/",
  RouteController.createUser
)
router.put(
  "/:id",
  RouteController.updateUser
)
router.put(
  "/:id/photo",
  multerMiddleware,
  RouteController.updateUserPhoto
)
router.delete(
  "/me/photo",
  multerMiddleware,
  RouteController.deleteUserPhoto
)
router.delete(
  "/:id",
  RouteController.deleteUser
)

export default router