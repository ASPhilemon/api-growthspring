import Joi from "joi";

//reusable fields
let objectIdPattern = /^[a-f0-9]{24}$/i

const objectId = Joi.string().pattern(objectIdPattern)

const userId = objectId.required()

const investment = Joi.object({
  amount: Joi.number().min(1),
  units: Joi.number().min(1),
  unitsDate: Joi.date()
})

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
})

export const updateUser = Joi.object({
  userId,
  update:{
    fullName: Joi.string().min(1),
    email: Joi.string().email(),
    phoneContact: Joi.string(),
    membershipDate: Joi.date(),
    permanentInvestment: investment,
    temporaryInvestment: investment,
    dob: birthday,
    points: Joi.number().integer().min(1),
    isActive: Joi.boolean(),
    isAdmin: Joi.boolean(),
    displayName: Joi.string()
  }
})

export const updateUserPhoto = Joi.object({
  userId,
  tempPhotoPath: Joi.string().required()
})

export const deleteUserPhoto = userId

export const addPoints = Joi.object({
  userId,
  points: Joi.number().integer()
}).unknown(false)

export const transferPoints = Joi.object({
  senderId: userId,
  recipientId: userId,
  points: Joi.number().integer().min(1).required(),
  reason: Joi.string().required()
}).unknown(false)

export const updatePermanentInvestment = investmentUpdate

export const updateTemporaryInvestment = investmentUpdate

export const deleteUser = userId