import mongoose from "mongoose";

//schemas
const investmentSubSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  units: {
    type: Number,
    required: true,
  },
  unitsDate: {
    type: Date,
    required: true,
  }
}, {_id: false})

const birthdaySubSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  }
})

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  phoneContact: {
    type: String,
    required: true
  },
  membershipDate: {
    type: Date,
    required: true
  },
  permanentInvestment: {
    type: investmentSubSchema,
    required: true
  },
  temporaryInvestment: {
    type: investmentSubSchema,
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    required: true,
  },
  dob: birthdaySubSchema,
  isAdmin: Boolean,
  displayName: String,
  photoURL: String,
})

// --- Schema for Dashboard Appearance ---

const appearanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  layout: {
    type: String,
    required: true,
    enum: ["Layout 1", "Layout 2"],
    default: "Layout 1"
  },
  color: {
    type: String,
    required: true,
    enum: ["blue", "gold"],
    default: "gold"
  },
}, { timestamps: true });

//models
const User  = mongoose.model(
  'user',
  userSchema
);

const Appearance  = mongoose.model(
  'appearance',
  appearanceSchema
);

export { User, Appearance }