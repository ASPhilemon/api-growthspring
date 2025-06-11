import JWT from "jsonwebtoken"
import { OAuth2Client } from "google-auth-library"
import * as PasswordUtil from "../../utils/password-util.js"

import { OTP, Credential } from "./models.js"

//utils
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator.js"

//collaborator services
import * as EmailServiceManager from "../email-service/service.js"
import * as UserServiceManager from "../user-service/service.js"

export async function signInWithPassword(email, password, cfTurnstileResponse){
  Validator.required({ password, cfTurnstileResponse })
  Validator.email(email)

  await _verifyCfTurnstileResponse(cfTurnstileResponse)

  const credential = await DB.query(Credential.findOne({"user.email": email}))
  Validator.assert(credential, "Incorrect email or password")

  const hash = credential.password
  PasswordUtil.matchPasswordWithHash(password, hash)

  return _createJWT(user._id, user.fullName, user.isAdmin)

}

export async function signInWithGoogle(googleToken){
  Validator.required({googleToken})
  const userEmail = await _getUserEmailFromGoogleToken(googleToken)

  const credential = await DB.query(Credential.findOne({"user.email": userEmail}))
  Validator.assert(
    credential, 
    `Sorry, the email ${userEmail} does 
    not exist in our database! 
    Please sign in with a registered email.`
  )

  return _createJWT(user._id, user.fullName, user.isAdmin)

  async function _getUserEmailFromGoogleToken(token) {
    const client = new OAuth2Client();
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: "992763288057-4ubs14aaahtdo0bmododpf9hqiovjgch.apps.googleusercontent.com",
      });
      return ticket.getPayload().email;
    }
    catch(err){
      throw new Errors.BadRequestError({message: "Failed to verify google token", cause: err})
    }
  }
}

export async function signInWithWebAuthn(){

}

export async function createOTP(email, otpPurpose, cfTurnstileResponse){
  Validator.required({otpPurpose, cfTurnstileResponse})
  Validator.email(email)
  await _verifyCfTurnstileResponse(cfTurnstileResponse)

  const credential = await DB.query(Credential.findOne({"user.email": email}))
  let otp
  if (credential){
    otp = _buildOTP(email, otpPurpose)
    await DB.query(OTP.create(otp))
  }

  if (credential) _sendOTPCreatedEmail(otp);

  function _buildOTP(email, otpPurpose){
    const minOTPCode = 1e8
    const maxOTPCode = 1e9
    const code = String( crypto.randomInt(minOTPCode, maxOTPCode) )
    return {email, purpose: otpPurpose, code}
  }
  function _sendOTPCreatedEmail(otp){
    EmailServiceManager.sendEmail({
      sender:"growthspring",
      recipient: otp.email,
      subject: `One Time Password - ${otp.purpose} `,
      message: `OTP Email Link`
    })
  }
}

export async function resetPassword(otpCode, newPassword, cfTurnstileResponse){
  Validator.required({otpCode, newPassword, cfTurnstileResponse })
  PasswordUtil.validatePasswordStrength(newPassword)
  
  const otp = await DB.query(OTP.findOne({code: otpCode, purpose: "reset-password"}))
  Validator.assert(otp, "The OTP is expired or incorrect")

  const hashedPassword = PasswordUtil.hashPassword(newPassword)

  await DB.transaction(async()=>{
    await DB.query(Credential.updateOne(
      {"user.email": otp.email},
      {$set:{password: hashedPassword}})
    )
    await DB.query(OTP.deleteOne({code: otp.code}))
  })

  _sendPasswordResetEmail(otp.email)

  async function _sendPasswordResetEmail(email){
    const user = await UserServiceManager.getUserByEmail(email)
    EmailServiceManager.sendEmail({
      sender: "growthspring",
      recipient: user.email,
      subject: "Password Reset Successful",
      message: `Dear ${user.fullName}, you have successfully reset your password`
    })
  }

}

export function verifyJWT(jwt){
  Validator.required({jwt})
  try{
    return JWT.verify(jwt, process.env.JWT_SECRET)
  }
  catch(err){
    throw new Errors.BadRequestError({message: "Failed to verify provided JWT", cause: err})
  }
}


//helpers
function _createJWT(userId, fullName, isAdmin) {
  const expiryDuration = '40d' 
  return JWT.sign(
    {_id: userId, fullName, isAdmin}, process.env.JWT_SECRET,
    { expiresIn: expiryDuration }
  )
}


async function _verifyCfTurnstileResponse(cfTurnstileResponse){
  const CLOUDFLARE_TURNSTILE_API = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
  const response = await fetch(CLOUDFLARE_TURNSTILE_API, {
    method: 'POST',
    body: new URLSearchParams({
      secret: process.env.CF_TURNSTILE_SECRET,
      response: cfTurnstileResponse,
    }),
  });

  const jsonResponse = await response.json();

  Validator.assert(jsonResponse.success, "Failed to verify you're not a bot")

}
