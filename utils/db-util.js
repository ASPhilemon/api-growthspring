import * as Errors from "./error-util.js"
import mongoose from "mongoose"

export async function query(promise) {
  try {
    return await promise
  } catch (err) {
    console.log("In DB.query error")
    _handleMongooseError(err)
  }
}

export async function transaction(callback, {isInActiveTransaction} = {}) {
  try {
    isInActiveTransaction?
    await callback():
    await mongoose.connection.transaction(callback);
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

  //throw new Errors.InternalServerError({cause: err})
  console.log(err)
  
}