import { AppError } from '../utils/error-util.js';
import * as Response from "../utils/http-response-util.js"

export function errorHandler(err, req, res, next) {
  console.log(err)
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errMessage = isAppError ? err.message : 'Sorry, an unknown error occured';
  Response.sendError(errMessage, statusCode, {req, res})
}