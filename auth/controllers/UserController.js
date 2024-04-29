const UserModel = require('../models/UserModel')
const OTPModel = require('../models/OTPModel')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const {sendMail} = require('../../util/sendMail')

function createToken (id, fullName){
  const expiryDuration = '60d' 
  return jwt.sign({id, fullName},  'top_secret_xyz123', { expiresIn: expiryDuration })
}

// login a user
async function loginUser(req, res) {
  const {email, password} = req.body

  try {
    let user = await UserModel.login(email, password)

    // create a token
    const token = createToken(user._id, user.fullName)
    user = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      membershipDate: user.membershipDate,
      isAdmin: user.isAdmin,
      token,
      photoURL : user.photoURL,
    }

    res.status(200).json({user})
  } catch (error) {
    res.status(400).json({error: error.message})
  }
}

// create a user
async function createUser (req, res){
  const { email, fullName, phoneContact, } = req.body
  const password = crypto.randomBytes(8).toString('hex');

  try {
    const user = await UserModel.createUser({email, fullName, phoneContact, password})
    res.status(200).json(user)

    //send email to new account email
    try {
    let senderName = "GrowthSpring Club";
    let recipientEmail = email
    let emailSubject = "Account Created"
    let emailTemplate = __dirname + '/../' + '/views/accountCreatedView.ejs'
    let context = {password}
    sendMail({senderName, recipientEmail, emailSubject, emailTemplate, context})
  } catch(err){
    console.log(err)
  }

  } catch (err) {
    res.status(400).json({error: err.message})
  }
}
// get users
async function getUsers (req, res){
  const users = await UserModel.find({}).select("_id fullName email")
  return res.json(users)
}
// Change password
async function changePassword(req, res) {
  const {otpCode, email, newPassword} = req.body
  
  try {
    //validation
    //missing fields
    if (!otpCode || !email || !newPassword) throw Error("Missing fields")
    //short password
    if(newPassword.length < 6) throw Error("Short password")
    //otp exists
    const otpDoc = await OTPModel.findOne({email })
    if (!otpDoc) throw Error("The OTP provided is not correct or is expired")
    //otp correct
    const match = await bcrypt.compare(otpCode, otpDoc.otpCode)
    if (!match) {
      throw Error('Incorrect OTP')
    }
    //update password
    const user = await UserModel.findOne({ email })
    user.password = newPassword
    await user.save()
    res.status(200).json({ message: 'Password Change Successful' })

    //send password change email
    try{
      let senderName = "Reset Password";
      let recipientEmail = email
      let emailSubject = "Password Changed"
      let emailTemplate = __dirname + '/../' + '/views/passChangeOkView.ejs'
      let context = {}
      sendMail({ senderName, recipientEmail, emailSubject, emailTemplate, context})
    } catch(err){
      console.log(err)
    }

  } catch (err) {
    return res.status(403).json({error: err.message})
  }
}

module.exports = { createUser, getUsers, loginUser, changePassword }