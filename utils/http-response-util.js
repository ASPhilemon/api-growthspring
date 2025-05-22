export function sendSuccess(res, data) {
  return res.json({ error: null, data })
}

export function sendError(res, message, statusCode) {
  return res.status(statusCode).json({ error: message, data: null })
}