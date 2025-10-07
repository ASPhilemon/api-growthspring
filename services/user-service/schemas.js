import Joi from "joi";
import mongoose from "mongoose";

//reusable fields
const objectId = Joi.custom((value, helpers) => {
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return value;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return helpers.message("Failed to validate objectId");
}, "ObjectId validation");

const userId = objectId

const investment = Joi.object({
  amount: Joi.number().min(1).required(),
  units: Joi.number().min(1).required(),
  unitsDate: Joi.date().required()
}).unknown(false)

const investmentUpdate = Joi.object({
  userId,
  update: Joi.object({
    deltaAmount: Joi.number(),
    deltaUnits: Joi.number(),
    newUnitsDate: Joi.date(),
  }).required().unknown(false)
}).unknown(false)

const birthday = Joi.object({
    month: Joi.number().integer().min(1).max(12).required(),
    day: Joi.number().integer().min(1).max(31).required(),
  }).unknown(false)


//exported schemas
export const getUserById = userId

export const getUserByEmail = Joi.string().email()

export const getUserDashboard = userId

export const createUser = Joi.object({
  fullName: Joi.string().min(1).required(),
  email: Joi.string().email().required(),
  phoneContact: Joi.string().required(),
  dob: birthday.required()
}).unknown(false).required(true)

export const updateUser = Joi.object({
  userId,
  update:Joi.object({
    fullName: Joi.string().min(1),
    email: Joi.string().email(),
    phoneContact: Joi.string(),
    membershipDate: Joi.date(),
    permanentInvestment: investment,
    temporaryInvestment: investment,
    dob: birthday,
    points: Joi.number().min(0),
    isActive: Joi.boolean(),
    isAdmin: Joi.boolean(),
    displayName: Joi.string()
  }).unknown(false)
})

export const updateUserRestricted = Joi.object({
  userId,
  update:Joi.object({
    phoneContact: Joi.string(),
    dob: birthday,
    displayName: Joi.string()
  }).unknown(false)
}).unknown(false)

export const updateUserPhoto = Joi.object({
  userId,
  tempPhotoPath: Joi.string().required()
})

export const deleteUserPhoto = userId

export const addPoints = Joi.object({
  userId,
  points: Joi.number()
}).unknown(false)

export const transferPoints = Joi.object({
  senderId: userId,
  recipientId: userId,
  points: Joi.number().min(1).required(),
  reason: Joi.string().required()
}).unknown(false)

export const updatePermanentInvestment = investmentUpdate

export const updateTemporaryInvestment = investmentUpdate

export const deleteUser = userId