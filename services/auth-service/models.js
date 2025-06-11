import mongoose from "mongoose";

const { ObjectId } = mongoose.Types 

//schemas
const userSubSchema = new mongoose.model({
  _id: {
    type: ObjectId,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  fullName:{
    type: String,
    required: true
  }
})

const credentialSchema = new mongoose.Schema({
  user: {
    type: userSubSchema,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  webAuthn: {
    type: String,
  }
})

const otpSchema = new mongoose.Schema({
  email:{
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ["reset-password", "register-webauthn"],
    required: true,
  },
  expireAt: {
    type: Date, 
    expires: 60*10 //10 minutes
  }
}, { timestamps:true });


//models
const OTP  = mongoose.model('otp', otpSchema );
const Credential  = mongoose.model('credential', credentialSchema );
export { OTP, Credential }