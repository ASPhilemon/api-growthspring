import * as ErrorUtil from "./error-util.js"
import mongoose from "mongoose"

export async function query(promise) {
  try {
    return await promise
  } catch (err) {
    ErrorUtil.handleMongooseError(err)
  }
}

export async function transaction(callback) {
  try {
    await mongoose.connection.transaction(callback);
  }
  catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof mongoose.Error) _handleMongooseError(err);
    throw new ErrorUtil.UnknownError({cause: err})
  }
}

function _handleMongooseError(err){
  const { ValidationError, CastError, StrictModeError } = mongoose.Error

  if (err instanceof ValidationError ||
      err instanceof CastError ||
      err instanceof StrictModeError){
    throw new BadRequestError("Failed to validate user input", err)
  }
  
  throw new InternalServerError({cause: err})
  
}