const express = require('express')
const {requireAuth, requireAdmin} = require('./middleware')

// User Controller Functions
const { loginUser, createUser, changePassword} = require('./controllers/UserController')
// OTP Controller Functions
const { createOTP} = require('./controllers/OTPController')

const router = express.Router()

// login user
router.post('/login', loginUser)

// create user
router.post('/create-user', requireAuth, requireAdmin, createUser)

// Create OTP
router.post('/create-otp', createOTP)

// Change password
router.post('/change-password', changePassword)

module.exports = router