import * as Errors from "./error-util.js"
import Joi from "joi"

export function schema(input, schema){
  const { error } =  schema.validate(input)
  if(error) throw new Errors.ValidationError(error.details[0].message)
}

export function required(input){
  for (const key in input){
    if (!input[key]) throw new Errors.ValidationError(`${key} is required.`)
  }
}

export function assert(arg, errMessage, {errType = Errors.BadRequestError}){
  if (!arg){
    if (errType == Errors.InternalServerError){
      throw new Errors.InternalServerError({cause: new Error(errMessage)})
    }
    else {
      throw new errType(errMessage);
    }
  }
}

export function email(email){
  const emailSchema = Joi.object({
    email: Joi.string().email().required()
  })

  const {error } = emailSchema.validate({email})

  if(error) throw new Errors.ValidationError(error.details[0].message)
}


