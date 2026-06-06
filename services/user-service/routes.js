import path from "path"
import express from "express"
import multer from "multer"
import * as RouteController  from "./controller.js"

import { fileURLToPath } from "url"

const router = express.Router()

//Multer set up
const fileURL = import.meta.url
const filePath = fileURLToPath(fileURL)
const moduleDirectory = path.dirname(filePath)
const uploadsDirectory = path.join(moduleDirectory, "..", "..", "uploads")

const upload = multer({ dest: uploadsDirectory,  limits: {
    fileSize: 15 * 1024 * 1024
  } });
const multerMiddleware = upload.single('photo')

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