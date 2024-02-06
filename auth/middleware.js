const jwt = require('jsonwebtoken')
const UserModel = require('./models/UserModel')
require('dotenv').config()

async function requireAuth(req, res, next){

  const { authorization } = req.headers
  if (!authorization) {
    return res.status(401).json({error: 'Authentication failed'})
  }
  const token = authorization.split(' ')[1]

  try {
    const { _id } = jwt.verify(token, process.env.SECRET || 'top-secret-asphilemon')
    req.user = await UserModel.findOne({ _id })
    next()
  } catch (err) {
    res.status(401).json({error: 'Authentication failed'})
  }
}

function requireAdmin(req, res, next){
  if (!req.user.isAdmin){
    return res.status(403).json({error: 'Authorization failed'})
  }
  next()
}


module.exports = { requireAuth, requireAdmin}