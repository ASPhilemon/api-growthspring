import * as Errors from "./error-util.js"

export function schema(schema, input){
  const { error } =  schema.validate(input)
  if(error) {throw new Errors.BadRequestError({message: "Failed to validate input", cause: error})}
}

export function required(input) {
  const missing = Object.keys(input).filter(key => input[key] === undefined || input[key] === null);
  if (missing.length > 0) {
    throw new Errors.BadRequestError({ message: `Missing required fields: ${missing.join(', ')}` });
  }
}