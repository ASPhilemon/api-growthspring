
const OTPModel = require('../models/OTPModel')
const {sendMail} = require('../../util/sendMail')

async function createOTP(req, res){
  const { email } = req.body
  let otpCode;
  try{
    otpCode = await OTPModel.createOTP(email)
  } catch(err){
    return res.status(400).json({error: err.message})
  }
  
  //Send mail
  try{
    let senderName = "accounts";
    let recipientEmail = email
    let emailSubject = "OTP"
    let emailTemplate = __dirname + '/../' + '/views/otpView.ejs'
    let replyTo = "philemonariko@gmail.com"
    let context = {otpCode}
    sendMail({senderName, recipientEmail, emailSubject, emailTemplate, replyTo, context})
    res.status(200).json({mssg: "email sent"})
  } catch(err){
    res.status(400).json({error: err.message})
  }
}

module.exports = { createOTP } 
