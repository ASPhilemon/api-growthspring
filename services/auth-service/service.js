import JWT from "jsonwebtoken"
import * as WebAuthn from '@simplewebauthn/server'
import generator from 'generate-password';
import bcrypt from 'bcryptjs';
import zxcvbn from "zxcvbn"
import crypto from "crypto"

import { OAuth2Client } from "google-auth-library"

import { OTP, Password, Passkey, Challenge } from "./models.js"

//utils
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator-util.js"

//collaborator services
import * as EmailServiceManager from "../email-service/service.js"
import * as UserServiceManager from "../user-service/service.js"

export async function signInWithPassword(email, password, cfTurnstileResponse){
  await _verifyCfTurnstileResponse(cfTurnstileResponse)

  const hashedPassword = (await DB.query(Password.findOne({"user.email": email}))).hash
    Validator.assert(hashedPassword, "Incorrect email or password")

  await matchPasswordWithHash(password, hashedPassword)

  const user = await UserServiceManager.getUserByEmail(email)
  return createJWT(user._id, user.fullName, user.isAdmin)

}

export async function signInWithGoogle(googleToken){
  const userEmail = await _getUserEmailFromGoogleToken(googleToken)

  const password = await DB.query(Password.findOne({"user.email": userEmail}))
  Validator.assert(
    password, 
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

export async function getPasswordByUserId(userId){
  const password = await DB.query(Password.findOne({"user._id": userId}))
  if (!password) throw new Errors.NotFoundError("Failed to find password");
  return password
}

export async function getPasswordByUserEmail(userEmail){
  const password = await DB.query(Password.findOne({"user.email": userEmail}))
  if (!password) throw new Errors.NotFoundError("Failed to find password");
  return password
}

export async function createOTP(email, otpPurpose, cfTurnstileResponse){
  await _verifyCfTurnstileResponse(cfTurnstileResponse)
  let otp = _buildOTP(email, otpPurpose)
  try{
    await getPasswordByUserEmail(email)
    await DB.query(OTP.create(otp))
    sendOTPCreatedEmail(otp);
  }
  catch(err){
    if(!(err instanceof Errors.NotFoundError)) throw err
  }
}
 
export async function resetPassword(otpCode, newPassword, cfTurnstileResponse){
  validatePasswordStrength(newPassword)

  const otp = await DB.query(OTP.findOne({code: otpCode, purpose: "reset-password"}))
  if(!otp) throw new Errors.BadRequestError("The OTP is expired or incorrect");

  const hash = hashPassword(newPassword)

  await DB.transaction(async()=>{
    await DB.query(Password.updateOne(
      {"user.email": otp.email},
      {$set:{hash}})
    )
    await DB.query(OTP.deleteOne({code: otp.code}))
  })
  sendPasswordResetEmail(otp.email)
}

export function verifyJWT(jwt){
  const JWT_SECRET = process.env.JWT_SECRET
  try{
    return JWT.verify(jwt, JWT_SECRET)
  }
  catch(err){
    throw new Errors.BadRequestError({message: "Failed to verify provided JWT", cause: err})
  }
}

export function createJWT(userId, fullName, isAdmin) {
  const expiryDuration = '40d' 
  return JWT.sign(
    {_id: userId, fullName, isAdmin}, process.env.JWT_SECRET,
    { expiresIn: expiryDuration }
  )
}

export async function createPassword(userId, fullName, email){
  const password = _generatePassword()
  const hash = hashPassword(password)
  await Password.create({
    user: {_id: userId, fullName, email},
    hash
  })
  return password
}

async function sendPasswordResetEmail(email){
  const user = await UserServiceManager.getUserByEmail(email)
  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: user.email,
    subject: "Password Reset Successful",
    message: `Dear ${user.fullName}, you have successfully reset your password`
  })
}

function sendOTPCreatedEmail(otp){
  EmailServiceManager.sendEmail({
    sender:"growthspring",
    recipient: otp.email,
    subject: `One Time Password - ${otp.purpose} `,
    message: `OTP Email Link`
  })
}

//WebAuthn
export async function getRegistrationOptionsWebAuthn(otpCode){
  const otp = await DB.query(OTP.findOne({code: otpCode}))
  Validator.assert(otp, "OTP code is invalid or expired")

  //get already registered passkeys for the user in otp
  const userPasskeys = await DB.query(Passkey.find({"user.email": otp.email}))

  const registrationOptions = await _generateRestrationOptions(otp.email, userPasskeys)

  const challenge = await DB.query(Challenge.create({
    challenge: registrationOptions.challenge,
    email: otp.email,
    webAuthnUserID: registrationOptions.user.id,
    type: "registration"
  }))

  return {registrationOptions, challengeId: challenge._id}
}

export async function verifyRegistrationWebAuthn(registrationResponse, challengeId){
  const challenge = await DB.query(Challenge.findOne({_id: challengeId, type:"registration"}))
  Validator.assert(challenge, "Challenge not found")

  await _validateRegistrationResponse(challenge, registrationResponse)

  await _createPasskey(verification, challenge)

  async function _validateRegistrationResponse(challenge, response){
    const {rpId, origin} = _getWebAuthnConstants()
    let verification;
    try {
      verification = await WebAuthn.verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
      });
    }
    catch (error) {
      throw new Errors.BadRequestError("Failed to validate challenge")
    }

    Validator.assert(verification.verified, "Failed to validate registration response")

  }

  async function _createPasskey(verification, challenge){
    const { registrationInfo } = verification;
    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
    } = registrationInfo;
    
    const passkey = {
      email: challenge.email,
      webAuthnUserID: challenge.webAuthnUserID,
      credID: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    };

    await DB.query(Passkey.create(passkey))
  }
}

export async function getAuthenticationOptionsWebAuthn(){
  const {rpId} = _getWebAuthnConstants()
  const authenticationOptions = await WebAuthn.generateAuthenticationOptions({
    rpId,
    allowCredentials: []
  })

  const challenge = await DB.query(Challenge.create({
    challenge: authenticationOptions,
    type:"authentication"
  }))

  return {authenticationOptions, challengeId: challenge._id }
}

export async function verifyAuthenticationWebAuthn(response, challengeId){
  const challengePromise = DB.query(Challenge.findOne({
    _id: challengeId,
    type:"authentication"
  }))
  const passkeyPromise = DB.query(Passkey.findOne({
    credId: response.id,
  }))
  const [challenge, passkey] = await Promise.all([
    challengePromise, passkeyPromise
  ])
  Validator.assert(challenge, "Failed to find challenge")
  Validator.assert(passkey, "No passkey found for the user")

  const verification = await verifyResponse(response, passkey, challenge)

  const [updateResult, user] = await Promise.all([
    _updatePasskeyCounter(verification.authenticationInfo.newCounter, passkey),
    UserServiceManager.getUserByEmail({email: passkey.email})
  ])

  Validator.assert(updateResult.matchedCount, "Passkey not found")
  
  const jwt = _createJWT(user._id, user.fullName, user.isAdmin)

  return jwt

  //helpers
  async function verifyResponse(response, passkey, challenge){
    const {rpId, origin} = _getWebAuthnConstants()
    let verification;
    try {
      verification = await WebAuthn.verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        credential: {
          id: passkey.credId,
          publicKey: passkey.publicKey,
          counter: passkey.counter,
          transports: passkey.transports,
        },
      });
    } catch (error) {
      throw new Errors.BadRequestError("An error occured verifying response ")
    }

    Validator.assert(verification.verified, "Failed to verify authentication response")

    return verification
  }
  async function _updatePasskeyCounter(newCounter, passkey){
    passkey.counter = newCounter
    await DB.query(passkey.save())
  }
}

//helpers
function _buildOTP(email, otpPurpose){
  const minOTPCode = 1e5
  const maxOTPCode = 9e5
  const code = String( crypto.randomInt(minOTPCode, maxOTPCode) )
  return {email, purpose: otpPurpose, code}
}

function _generatePassword(){
  const password = generator.generate({
    length: 10,
    numbers: true,
    symbols: true,
    uppercase: true,
    lowercase: true,
    strict: true
  });

  return password
}

function validatePasswordStrength(password){
  const result = zxcvbn(password)
  if (result.score < 3){
    throw new Errors.BadRequestError("The password is too weak")
  }
}

async function matchPasswordWithHash(password, hash){
  const match = await bcrypt.compare(password, hash )
  if (!match) throw new Errors.BadRequestError("Incorrect email or password")
}

async function _verifyCfTurnstileResponse(cfTurnstileResponse){
  
  if (process.env.NODE_ENV != "production") return;

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

function _getWebAuthnConstants(){
  const rpName = "Growthspring Webauthn"
  const rpId = "auth.growthspringers.com"
  const origin = `https://${rpId}`
  return {rpName, rpId, origin}
}

async function _generateRestrationOptions(userEmail, userPasskeys){
  const {rpName, rpId} = _getWebAuthnConstants()
  const options = await WebAuthn.generateRegistrationOptions({
    rpName,
    rpId,
    userName: userEmail,
     attestationType: 'none',
    // Prevent users from re-registering existing authenticators
    excludeCredentials: userPasskeys.map(passkey => ({
      id: passkey.credId,
      // Optional
      transports: passkey.transports,
    })),
    // See "Guiding use of authenticators via authenticatorSelection" below
    authenticatorSelection: {
      // Defaults
      residentKey: 'preferred',
      userVerification: 'preferred',
      // Optional
      authenticatorAttachment: 'platform',
    }
  })

  return options
}

function hashPassword(plainPassword){
  const salt = bcrypt.genSaltSync()
  return bcrypt.hashSync(plainPassword, salt)
}