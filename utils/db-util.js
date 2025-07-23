import mongoose from "mongoose"
import { AsyncLocalStorage } from "node:async_hooks"
import * as Errors from "./error-util.js"

const transactionContext = new AsyncLocalStorage();

export async function transaction(callback) {
  const isInActiveTransaction = transactionContext.getStore();
  try {
    isInActiveTransaction ?
    await callback() :
    await mongoose.connection.transaction(async()=>{
      await transactionContext.run(true, callback);
    })
  }
  catch (err) {
    if (err instanceof Errors.AppError) throw err;
    if (err instanceof mongoose.Error) _handleMongooseError(err);
    throw new Errors.UnknownError({ cause: err });
  }
}

export async function query(promise) {
  try {
    return await promise
  } catch (err) {
    _handleMongooseError(err)
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