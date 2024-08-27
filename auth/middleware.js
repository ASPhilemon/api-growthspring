const jwt = require('jsonwebtoken')
const UserModel = require('./models/UserModel')

async function requireAuth(req, res, next) {
  const id = cookieAuth(req) || headerAuth(req)
  if(!id) return res.status(400).json({error: "Authentication failed"})
  const user = await UserModel.findById(id)
  req.user = user
  next()
}

function requireAdmin(req, res, next){
  if (!req.user.isAdmin){
    return res.status(403).json({error: 'Authorization failed'})
  }
  next()
}

function cookieAuth(req){
  //cookie token
  const token = req.cookies.jwt;
  try {
    const { id } = jwt.verify(token,  'top_secret_xyz123')
    return id
  } catch (err) {
    console.log('cookie auth error', err)
    return null
  }
}

function headerAuth(req){

  const authorization = req.headers['authorization']

  if (!authorization) {
    return null
  }

  const token = authorization.split(' ')[1]
  try {
    const {id } = jwt.verify(token, 'top_secret_xyz123')
    return id
  } catch (err) {
    console.log('header auth error', err)
    return null
  }
}

//kr

module.exports = { requireAuth, requireAdmin }