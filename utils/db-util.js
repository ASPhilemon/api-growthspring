import * as Errors from "./error-util.js"
import mongoose from "mongoose"

export async function query(promise) {
  try {
    return await promise
  } catch (err) {
    _handleMongooseError(err)
  }
}

export async function transaction(callback) {
  try {
    //await mongoose.connection.transaction(callback);
    await callback()
  }
  catch (err) {
    if (err instanceof Errors.AppError) throw err;
    if (err instanceof mongoose.Error) _handleMongooseError(err);
    throw new Errors.UnknownError({cause: err})
  }
}

function _handleMongooseError(err){
  const { ValidationError, CastError, StrictModeError } = mongoose.Error

  if (err instanceof ValidationError ||
      err instanceof CastError ||
      err instanceof StrictModeError){
    throw new Errors.BadRequestError("Failed to validate user input", err)
  }
  
  throw new Errors.InternalServerError({cause: err})
  
}