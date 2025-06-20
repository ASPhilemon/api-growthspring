import Joi from "joi";

let objectIdPattern = /^[a-f0-9]{24}$/i

export const getDeposits = Joi.object({
  filter: Joi.object({
    userId: objectId,
    month: Joi.number().integer().min(1).max(11),
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

export const getDepositById = objectId

export const recordDeposit = Joi.object({
  depositor: user,
  amount: depositAmount,
  date: Joi.date().required(),
  type: Joi.valid("Permanent", "Temporary").required(),
  recordedBy: user,
  source: Joi.valid("Savings", "Profits", "Excess Loan Payment", "Interest").required(),
  cashLocation: Joi.object({
    _id: objectId.required(),
    name: Joi.string().min(1).required()
  }).unknown(false),
  automatic: Joi.boolean()
}).unknown(false)

export const setDepositAmount = Joi.object({
  depositId: objectId.required(),
  newAmount: depositAmount
}).unknown(false)

export const deleteDeposit = objectId.required()

//reusable fields
const objectId = Joi.string().pattern(objectIdPattern)

const user = Joi.object({
  _id: objectId.required(),
  fullName: Joi.string().min(1).max(100).required()
}).required()

const depositAmount = Joi.number().greater(0).required()