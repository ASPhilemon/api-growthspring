import Joi from "joi";
import mongoose from "mongoose";

//reusable fields
let uuidv4Pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

const objectId = Joi.custom((value, helpers) => {
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return value;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return helpers.message("Failed to validate objectId");
}, "ObjectId validation");

const uuid = Joi.string().pattern(uuidv4Pattern)

const depositId = Joi.alternatives().try(
  uuid.required(),
  objectId.required()
);


const user = Joi.object({
  _id: objectId.required(),
  fullName: Joi.string().min(1).max(100)
})

const depositAmount = Joi.number().greater(0)

const depositDate = Joi.date().greater("2020-01-01")

const cashLocation = Joi.object({
  _id: objectId.required(),
  name: Joi.valid("Standard Chartered", "Mobile Money", "Unit Trust").required()
}).unknown(false)


//exported schemas
export const getDeposits = Joi.object({
  filter: Joi.object({
    userId: objectId,
    month: Joi.number().integer().min(1).max(12),
    year: Joi.number().integer().min(2020).max(3000)
  }).unknown(false),

  sort: Joi.object({
    field: Joi.valid("amount", "date"),
    order: Joi.valid(1, -1),
  }).unknown(false),

  pagination: Joi.object({
    page: Joi.number().integer().min(1),
    perPage: Joi.number().integer().min(1).max(100),
  }).unknown(false)

}).unknown(false)

export const getDepositById = depositId

export const recordDeposit = Joi.object({
  _id: depositId,
  depositor: user.required(),
  amount: depositAmount.required(),
  date: depositDate.required(),
  type: Joi.valid("Permanent", "Temporary").required(),
  recordedBy: user.required(),
  source: Joi.valid("Savings", "Profits", "Excess Loan Payment", "Interest").required(),
  cashLocation: cashLocation.required(),
}).required().unknown(false)

export const updateDeposit = Joi.object({
  depositId: depositId,
  update: Joi.object({
    amount: depositAmount,
    date: depositDate,
    cashLocationToAdd: cashLocation,
    cashLocationToDeduct: cashLocation,
    updatedById: objectId.required()
  })
}).required().unknown(false)

export const deleteDeposit = Joi.object({
  depositId: depositId,
  cashLocationToDeductId: objectId
}).unknown(false)