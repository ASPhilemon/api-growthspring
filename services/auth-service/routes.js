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
  "/otps", 
  RouteController.createOTP
)
router.post(
  "/reset-password", 
  RouteController.resetPassword
)

//webauthn 
router.get(
  "/webauthn-registartion-options", 
  RouteController.getRegisterationOptionsWebAuthn
)
router.get(
  "/webauthn-authentication-options", 
  RouteController.getAuthenticationOptionsWebAuthn
)
router.post(
  "/webauthn-verify-registartion", 
  RouteController.verifyRegisterationWebAuthn
)
router.post(
  "/webauthn-verify-authentication", 
  RouteController.verifyAuthenticationWebAuthn
)

//sign out
router.post(
  "/signout", 
  RouteController.signOut
)

export default router