export function sendSuccess(data, req, res) {
  return res.json({ error: null, data })
}

export function sendError(errMessage, statusCode, req, res) {
  return res.status(statusCode).json({ error: errMessage, data: null })
}