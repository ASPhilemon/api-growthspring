import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function signInWithPassword(req, res){
  const jwt = await ServiceManager.signInWithPassword()
  _setJWTCookie(jwt, res)
  Response.sendSuccess(jwt, {req, res})
}

export async function signInWithGoogle(req, res){
  const jwt = await ServiceManager.signInWithGoogle()
  _setJWTCookie(jwt, res)
  Response.sendSuccess(jwt, {req, res})
}

export async function signInWithWebAuthn(req, res){
  const jwt = await ServiceManager.signInWithWebAuthn()
  _setJWTCookie(jwt, res)
  Response.sendSuccess(jwt, {req, res})
}

export async function createOTP(req, res){
  await ServiceManager.createOTP()
  Response.sendSuccess(null, {req, res})
}

export async function resetPassword(req, res){
  await ServiceManager.resetPassword()
  Response.sendSuccess(null, {req, res})
}

export async function registerWebauthn(req, res){
  await ServiceManager.registerWebauthn()
  Response.sendSuccess(null, {req, res})
}

export async function signOut(req, res){
  const invalidJWT = "invalid";
  _setJWTCookie(invalidJWT, res, {cookieDuration:0})
  Response.sendSuccess(null, {req, res})
}

function _setJWTCookie(jwt, res, {cookieDuration}){
  if (!cookieDuration) cookieDuration = 40*24*60*60*1000; //40 days default 
  res.cookie('jwt', jwt, {
    httpOnly: true,
    maxAge: cookieDuration,
    secure: true,
    domain:"growthspringers.com"
  });
}