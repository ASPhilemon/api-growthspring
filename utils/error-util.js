import mongoose from "mongoose"

export class AppError extends Error {
  constructor({ message, statusCode, cause = null }) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  static buildArgs(arg1, defaultMessage, statusCode, arg2 = null) {
    if (typeof arg1 === "string") {
      return { message: arg1, statusCode, cause: arg2 };
    } else {
      return {
        message: arg1?.message || defaultMessage,
        statusCode,
        cause: arg1?.cause || null,
      };
    }
  }
}

export class NotAuthenticatedError extends AppError {
  constructor(arg1 = {}, arg2 = null) {
    const defaultMessage = "Failed to authenticate"
    const statusCode = 401
    super(AppError.buildArgs(arg1, defaultMessage , statusCode, arg2));
  }
}

export class NotAllowedError extends AppError {
  constructor(arg1 = {}, arg2 = null) {
    const defaultMessage = "Access denied"
    const statusCode = 403
    super(AppError.buildArgs(arg1, defaultMessage, statusCode, arg2));
  }
}

export class BadRequestError extends AppError {
  constructor(arg1 = {}, arg2 = null) {
    const defaultMessage = "The request has an error"
    const statusCode = 400
    super(AppError.buildArgs(arg1, defaultMessage, statusCode, arg2));
  }
}

export class NotFoundError extends AppError {
  constructor(arg1 = {}, arg2 = null) {
    const defaultMessage = "Resource not found on the server"
    const statusCode = 404
    super(AppError.buildArgs(arg1, defaultMessage, statusCode, arg2));
  }
}

export class InternalServerError extends AppError {
  constructor(arg1 = {}, arg2 = null) {
    const defaultMessage = "Internal server error"
    const statusCode = 500
    super(AppError.buildArgs(arg1, defaultMessage, statusCode, arg2));
  }
}


export function handleMongooseError(err){
  const { ValidationError, CastError } = mongoose.Error

  if (err instanceof ValidationError || err instanceof CastError){
    throw new BadRequestError("Failed to validate user input", err)
  }
  else{
    throw new InternalServerError()
  }
}