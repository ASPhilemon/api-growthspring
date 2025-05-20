import mongoose from "mongoose"

export class AppError extends Error {
  constructor(message, statusCode, cause) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleMongooseError(err){
  const { ValidationError, CastError } = mongoose.Error

  let statusCode
  if (err instanceof ValidationError || err instanceof CastError){
    statusCode = 400
    throw new AppError("Failed to validate user input", statusCode, err)
  }
  else{
    statusCode =  500
    throw new AppError("A database error occured", statusCode, err)
  }
}