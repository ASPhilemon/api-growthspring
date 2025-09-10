import Joi from "joi";

//reusable fields
let objectIdPattern = /^[a-f0-9]{24}$/i

let uuidv4Pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

const objectId = Joi.string().pattern(objectIdPattern)

const uuid = Joi.string().pattern(uuidv4Pattern)

const points = Joi.number().integer().greater(0)


//exported schemas
export const getTransactions = Joi.object({
  filter: Joi.object({
    userId: objectId,
    type: Joi.valid("award", "redeem", "transfer"),
    month: Joi.number().integer().min(1).max(12),
    year: Joi.number().integer().min(2020).max(3000)
  }).unknown(false),

  sort: Joi.object({
    field: Joi.valid("points", "date"),
    order: Joi.valid(1, -1),
  }).unknown(false),

  pagination: Joi.object({
    page: Joi.number().integer().min(1),
    perPage: Joi.number().integer().min(1).max(100),
  }).unknown(false)

}).unknown(false)

export const getTransactionById = uuid.required()

export const getTransactionByRefId = Joi.string().required()

export const recordTransaction = Joi.object({
  type: Joi.valid("award", "redeem", "transfer"),
}).required()

export const awardPoints = Joi.object({
  userId: objectId.required(),
  points: points,
  reason: Joi.string().required(),
  refId: Joi.string().required()
}).required().unknown(false)

export const redeemPoints = awardPoints

export const transferPoints = Joi.object({
  senderId: objectId.required(),
  recipientId: objectId.required(),
  points: points,
  reason: Joi.string().required(),
}).required().unknown(false)

export const findByIdAndUpdatePoints = Joi.object({
  transactionId: objectId.required(),
  newPoints: points,
}).unknown(false)

export const findByRefIdAndUpdatePoints = Joi.object({
  refId: Joi.string().required(),
  newPoints: points
})

export const deleteTransactionById = objectId.required()
export const deleteTransactionByRefId = Joi.string().required()