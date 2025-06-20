import * as Errors from "./error-util.js"

export function schema(schema, input){
  const { error } =  schema.validate(input)
  if(error) throw new Errors.BadRequestError({message: "Failed to validate input", cause: error})
}