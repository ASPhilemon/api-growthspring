import * as Errors from "./error-util.js"

export function schema(schema, input){
  const { error } =  schema.validate(input)
  if(error) throw new Errors.BadRequestError({message: "Failed to validate input", cause: error})
}

export function assert(expr, errMessage, errType) {
  let ErrorConstructor = errType?.errType || errType || Errors.BadRequestError;
  if (!expr) {
    // Pass an object with message and statusCode to ensure compatibility with AppError
    throw new ErrorConstructor({ message: errMessage });
  }
}

export function required(input) {
  const missing = Object.keys(input).filter(key => input[key] === undefined || input[key] === null);
  if (missing.length > 0) {
    throw new Errors.BadRequestError({ message: `Missing required fields: ${missing.join(', ')}` });
  }
}