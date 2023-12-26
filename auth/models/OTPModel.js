const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const UserModel = require('./UserModel')


//OTP Schema
const Schema = mongoose.Schema;
const OTPSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  otpCode: {
    type: String,
    required: true
  },
  expireAt: {
    type: Date, 
    default: Date.now,
    expires: 60*5
  }
})

OTPSchema.statics.createOTP = async function(email) {
  console.log(email);
  //email validation
  const user = await UserModel.findOne( {email} )
  if ( !user) throw Error("That email does not exist")
  //generate otp
  const otpCode = String( crypto.randomInt(111111, 999999) )
  
  //save otpDoc
  await this.findOneAndDelete({email})
  await this.create(
    {email, otpCode}
  )
  return otpCode
}
  
// fire a function before doc saved to db
OTPSchema.pre('save', async function(next) {
  const salt = await bcrypt.genSalt();
  this.otpCode = await bcrypt.hash(this.otpCode, salt);
  next();
});


const OTPModel = mongoose.model('otp', OTPSchema);

module.exports = OTPModel