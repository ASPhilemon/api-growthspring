import mongoose from "mongoose"

export class AppError extends Error {
  constructor({ message, statusCode, cause = null}) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotAuthenticatedError extends AppError {
  constructor({message = "Failed to authenticate request", cause = null}={}) {
    const statusCode = 401
    super({message, statusCode, cause});
  }
}

export class NotAllowedError extends AppError {
  constructor({message = "Access Denied", cause = null}={}) {
    const statusCode = 403
    super({message, statusCode, cause});
  }
}

export class BadRequestError extends AppError {
  constructor({message = "There was something wrong in your request", cause = null}={}) {
    const statusCode = 400
    super({message, statusCode, cause});
  }
}

export class NotFoundError extends AppError {
  constructor({message = "Resource not found", cause = null}={}) {
    const statusCode = 404
    super({message, statusCode, cause});
  }
}

export class InternalServerError extends AppError {
  constructor({message = "Sorry, something went wrong on the server", cause = null}={}) {
    const statusCode = 500
    super({message, statusCode, cause});
  }
}

export function handleMongooseError(err){
  const { ValidationError, CastError } = mongoose.Error

  if (err instanceof ValidationError || err instanceof CastError){
    throw new BadRequestError({message: "Failed to validate user input", cause: err})
  }
  else{
    throw new InternalServerError()
  }
}