import Joi from "joi";

//reusable fields
let objectIdPattern = /^[a-f0-9]{24}$/i

let uuidv4Pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

const objectId = Joi.string().pattern(objectIdPattern)

const uuid = Joi.string().pattern(uuidv4Pattern)

const user = Joi.object({
  _id: objectId.required(),
  fullName: Joi.string().min(1).max(100).required()
}).required()

const withdrawAmount = Joi.number().greater(0)

const withdrawDate = Joi.date().greater("2020-01-01")

const cashLocation = Joi.object({
  _id: objectId.required(),
  name: Joi.valid("Standard Chartered", "Mobile Money", "Unit Trust").required()
}).unknown(false)


//exported schemas
export const getWithdraws = Joi.object({
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

export const getWithdrawById = uuid.required()

export const recordWithdraw = Joi.object({
  _id: uuid.required(),
  withdrawnBy: user,
  amount: withdrawAmount,
  date: withdrawDate,
  recordedBy: user,
  cashLocation: cashLocation,
}).required().unknown(false)

export const updateWithdraw = Joi.object({
  withdrawId: uuid.required(),
  update: Joi.object({
    amount: withdrawAmount.required(),
    date: withdrawDate.required(),
    cashLocationToAdd: cashLocation.required(),
    cashLocationToDeduct: cashLocation.required(),
  })
}).required().unknown(false)

export const deleteWithdraw = Joi.object({
  withdrawId: uuid.required(),
  cashLocationToAddId: objectId.required()
}).unknown(false)