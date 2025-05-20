// middleware/errorHandler.js
import { AppError } from '../utils/error-util.js';

export function errorHandler(err, req, res, next) {
  console.log(err)
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'Sorry, an unknown error occured';
  res.status(statusCode).json({error: message, data: null})
}