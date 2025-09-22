import path from "path"
import express from "express"
import multer from "multer"
import * as RouteController  from "./controller.js"

import { requireUser, requireAdmin } from "../../middleware.js"
import { fileURLToPath } from "url"

const router = express.Router()

//multer set up
const fileURL = import.meta.url
const filePath = fileURLToPath(fileURL)
const moduleDirectory = path.dirname(filePath)
const uploadsDirectory = path.join(moduleDirectory, "..", "..", "uploads")
const upload = multer({ dest: uploadsDirectory,  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  } });
const multerMiddleware = upload.single('photo')

//logged in user only
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
  upload.single('photo'),
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
router.post(
  "/me/appearance",
  RouteController.changeAppearance
)
router.get(
  "/me/admin-dashboard",
  RouteController.getAdminDashboard
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
  "/:id/dashboard",
  RouteController.getUserDashboard
)
router.get(
  "/admin-dashbord",
  RouteController.getAdminDashboard
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
  "/:id/photo",
  multerMiddleware,
  RouteController.deleteUserPhoto
)
router.delete(
  "/:id",
  RouteController.deleteUser
)

export default router