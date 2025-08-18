import mongoose from "mongoose";

const { ObjectId } = mongoose.Types 

//schemas
const userSubSchema = new mongoose.Schema({
  _id: {
    type: ObjectId,
    required: true
  },
  fullName:{
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
})

const passwordSchema = new mongoose.Schema({
  user: {
    type: userSubSchema,
    required: true
  },
  hash: {
    type: String,
    required: true
  }
})

const passkeySchema = new mongoose.Schema({
  credId:{
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  publicKey:{
    type: Buffer,
    required: true,
  },
  webauthnUserID:{
    type: String,
    required: true,
  },
  counter:{
    type: Number,
    required: true
  },
  deviceType: {
    type: String,
    required: true
  },
  backedUp: {
    type: Boolean,
    required: true
  },
  transports: String
})

const challengeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: function () {
    return this.type === 'registration';
  }
  },
  challenge: {
    type: Buffer,
    required: true
  },
  webAuthnUserID:{
    type: String,
    required: function () {
    return this.type === 'registration';
  }
  },
  type:{
    type: String,
    enum: ["registration", "authentication"],
    required: true,
  },
  expireAt: {
    type: Date, 
    expires: 60*30 //30 minutes
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
    expires: 60*30 //30 minutes
  }
}, { timestamps:true });

//models
const OTP = mongoose.model('otp', otpSchema );
const Password  = mongoose.model('password', passwordSchema );
const Passkey  = mongoose.model('passkey', passkeySchema );
const Challenge  = mongoose.model('challenge', challengeSchema );

export { Password, Passkey, Challenge, OTP }