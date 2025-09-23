import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function signInWithPassword(req, res){
  const {email, password, cfTurnstileResponse} = req.body
  const jwt = await ServiceManager.signInWithPassword(email, password, cfTurnstileResponse)
    const cookieDuration = 60*60*24*40*1000 // 40 days
  _setCookie(res, {name: "jwt", value: jwt, duration:cookieDuration})
  Response.sendSuccess(jwt, {req, res})
}

export async function signInWithGoogle(req, res){
  const {credential} = req.body
  const jwt = await ServiceManager.signInWithGoogle(credential)
    const cookieDuration = 60*60*24*40 // 40 days
  _setCookie(res, {name: "jwt", value: jwt, duration:cookieDuration})
  Response.sendSuccess(jwt, {req, res})
}

export async function createOTP(req, res){
  const {email, otpPurpose} = req.body
  await ServiceManager.createOTP(email, otpPurpose)
  Response.sendSuccess(null, {req, res})
}

export async function resetPassword(req, res){
  const {otpCode, newPassword} = req.body
  await ServiceManager.resetPassword(otpCode, newPassword)
  Response.sendSuccess(null, {req, res})
}

export async function getRegisterationOptionsWebAuthn(req, res){
  const {otpCode} = req.query
  const {registrationOptions, challengeId} = await ServiceManager.getRegistrationOptionsWebAuthn(otpCode)
  _setCookie(res, {
    name:"challengeIdRegistration",
    value: challengeId,
    duration: 60*60 //1 hour
  })
  Response.sendSuccess(registrationOptions, {req, res})
}

export async function verifyRegisterationWebAuthn(req, res){
  const {registrationResponse} = req.body
  const {challengeIdRegistration:challengeId} = req.cookies
  await ServiceManager.verifyRegistrationWebAuthn(registrationResponse, challengeId)

  _clearCookie(res, "challengeIdRegistration")
  
  Response.sendSuccess(null, {req, res})
}

export async function getAuthenticationOptionsWebAuthn(req, res){
  const {authenticationOptions, challengeId} = await ServiceManager.getAuthenticationOptionsWebAuthn()
  _setCookie(res, {
    name:"challengeIdAuthentication",
    value: challengeId,
    duration: 60*60 //1 hour
  })
  Response.sendSuccess(authenticationOptions, {req, res})
}

export async function verifyAuthenticationWebAuthn(req, res){
  const {authenticationResponse:response} = req.body
  const {challengeIdAuthentication:challengeId} = req.cookies
  const jwt = await ServiceManager.verifyAuthenticationWebAuthn(response, challengeId)

  _setCookie(res, {
    name: "jwt",
    value: jwt,
    duration: 60*60*24*40 //40 days
  })

  _clearCookie(res, "challengeIdAuthentication")
  Response.sendSuccess(jwt, {req, res})
}

export async function signOut(req, res){
  _clearCookie(res, "jwt")
  Response.sendSuccess(null, {req, res})
}

function _setCookie(res, {name, value, duration }){
  console.log("cookie name = ", name, value, duration)
  res.cookie(name, value, {
    httpOnly: true,
    maxAge:duration,
    secure: true,
    domain:"growthspringers.com"
  });
}

function _clearCookie(res, cookieName){
  const cookieValue = "invalid"
  res.cookie(cookieName, cookieValue, {
    httpOnly: true,
    maxAge: 0,
    secure: true,
    domain:"growthspringers.com"
  });
}