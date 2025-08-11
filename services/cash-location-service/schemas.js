import Joi from "joi";

//reusable fields
let objectIdPattern = /^[a-f0-9]{24}$/i

let uuidv4Pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

const objectId = Joi.string().pattern(objectIdPattern)

const uuid = Joi.string().pattern(uuidv4Pattern)

const cashLocation = Joi.object({
  _id: objectId.required(),
  name: Joi.string().required().min(1)
})

//exported schemas

export const getCashLocationById = objectId.required()

export const updateCashLocation = Joi.object({
  cashLocationId: objectId.required(),
  update: Joi.object({
    amount: Joi.number().greater(0)
  })
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
