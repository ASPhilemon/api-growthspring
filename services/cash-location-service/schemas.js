import Joi from "joi";
import mongoose from "mongoose";

//reusable fields
let uuidv4Pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const uuid = Joi.string().pattern(uuidv4Pattern)

const objectId = Joi.custom((value, helpers) => {
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return value;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return helpers.message("Failed to validate objectId");
}, "ObjectId validation");


const user = Joi.object({
  _id: objectId.required(),
  fullName: Joi.string().min(1).max(100)
})

const cashLocation = Joi.object({
  _id: objectId.required(),
  name: Joi.valid("Standard Chartered", "Mobile Money", "Unit Trust")
})

//exported schemas

export const getCashLocationById = objectId.required()

export const updateCashLocation = Joi.object({
  cashLocationId: objectId.required(),
  update: Joi.object({
    amount: Joi.number().greater(0).required()
  }).required().unknown(false)
}).required().unknown(false)

export const addToCashLocation = Joi.object({
  cashLocationId: objectId.required(),
  amount: Joi.number()
}).required().unknown(false)

export const getTransferById = uuid.required()

export const recordTransfer = Joi.object({
  _id: uuid.required(),
  source: cashLocation,
  dest: cashLocation,
  amount: Joi.number().greater(0)
})

export const updateTransfer = Joi.object({
  transferId: uuid.required(),
  update: Joi.object({
    amount: Joi.number().greater(0)
  }).required().unknown(false)
}).required().unknown(false)


export const deleteTransfer = getTransferById
