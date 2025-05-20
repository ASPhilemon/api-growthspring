import mongoose from "mongoose"

export class AppError extends Error {
  constructor({message, statusCode, cause}) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleMongooseError(err){
  const { ValidationError, CastError } = mongoose.Error

  if (err instanceof ValidationError || err instanceof CastError){
    const statusCode = 400
    throw new AppError("Data validation failed", statusCode, err)
  }
  else{
    throw new AppError("A database error occured")
  }
}