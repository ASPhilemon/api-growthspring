import express from "express"

import * as RouteController  from "./controller.js"

const router = express.Router()

router.post(
  "/signin-password", 
  RouteController.signInWithPassword
)
router.post(
  "/signin-google", 
  RouteController.signInWithGoogle
)
router.post(
  "/signin-webauthn", 
  RouteController.signInWithWebAuthn
)
router.post(
  "/otps", 
  RouteController.createOTP
)
router.post(
  "/reset-password", 
  RouteController.resetPassword
)
router.post(
  "/register-webauthn", 
  RouteController.registerWebauthn
)
router.post(
  "/signout", 
  RouteController.signOut
)

export default router