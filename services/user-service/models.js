import mongoose from "mongoose";

//Schemas
const investmentSchema = new mongoose.Schema({
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

const birthdaySchema = new mongoose.Schema({
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

const uiThemeSchema = new mongoose.Schema({
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
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  phoneContact: String,
  membershipDate: {
    type: Date,
    required: true
  },
  permanentInvestment: {
    type: investmentSchema,
    required: true
  },
  temporaryInvestment: {
    type: investmentSchema,
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
  uiTheme: uiThemeSchema,
  dob: birthdaySchema,
  isAdmin: Boolean,
  displayName: String,
  photoURL: String,
})

//Models
const User  = mongoose.model(
  'user',
  userSchema
);

export { User }