const mongoose = require('mongoose');
const validator = require('validator')
const bcrypt = require('bcrypt')

//User Schema
const Schema = mongoose.Schema;
const userSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  phoneContact: {
    type: String,
    required: false
  },
  password: {
    type: String,
    required: true
  },
  
  cummulativeUnits: {
    type: Number,
    required: true
  },
  membershipDate: {
    type: Date,
    required: true
  },
  investmentAmount: {
    type: Number,
    required: true
  },
  investmentDate: {
    type: Date,
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  isAdmin: Boolean,
  displayName: String,
  photoURL: String,
  alerts: Boolean
})

userSchema.statics.createUser = async function({email, fullName, phoneContact, password}) {
// validation
//Missing fields
  if (!(email && fullName && phoneContact)) {
    throw Error('Missing fields')
  }
  //Invalid email
  if (!validator.isEmail(email)) {
    throw Error('Email not valid')
  }
  //Existing user
  const exists = await this.findOne({ email })
  if (exists) {
    throw Error('Email already in use')
  }

  const today = new Date().toISOString()
 

  const user = await this.create({ 
      email,
      password,
      fullName,
      phoneContact,
      membershipDate: today,
      investmentAmount: 0,
      investmentDate: today,
      cummulativeUnits: 0,
      points: 500
    }
  )
  return user
}

userSchema.statics.login = async function(email, password) {

  if (!email || !password) {
    throw Error('All fields must be filled')
  }

  const user = await this.findOne({ email })
  if (!user) {
    throw Error('Incorrect email')
  }

  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    throw Error('Incorrect password')
  }

  return user
}

// fire a function before doc saved to db
userSchema.pre('save', async function(next) {
  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);
  next();
});



const UserModel = mongoose.model('user', userSchema);
module.exports = UserModel