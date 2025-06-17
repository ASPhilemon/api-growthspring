import { User } from "./models.js"

//utils
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as PasswordUtil from "../../utils/password-util.js"
import * as Validator from "../../utils/validator-util.js"

//collaborator services
import * as EmailServiceManager from "../email-service/service.js"
import * as DepositServiceManager from "../deposit-service/service.js"
import * as LoanServiceManager from "../loan-service/service.js"

export async function getUsers(sort, pagination){
  const users = await User.getUsers(sort, pagination)
  return users
}

export async function getUserById(userId){
  const user = DB.query(User.findById(userId))
  Validator.assert(user, "Failed to find user", {errType: Errors.NotFoundError})
  return user
}

export async function getUserByEmail(email){
  const user = DB.query(await User.findOne({email}))
  Validator.assert(user, "Failed to find user", {errType: Errors.NotFoundError})
  return user
}

export async function getDashboard(userId){
  const filter = {userId}
  const [
    deposits,
    clubDeposits,
    loans
  ] = await Promise.all([
    DepositServiceManager.getDeposits({filter}),
    DepositServiceManager.getClubDeposits({filter}),
    LoanServiceManager.getLoans({filter})
  ])
}

export async function createUser(user){
  user = _buildUser(user)
  await User.create(user)
  EmailServiceManager.sendEmail({
    sender: "accounts",
    recipient: user.email,
    subject: "Account Created",
    message: `Dear ${user.fullName}, your growthspring account has been created successfuly. Your default login password is: ${password}`
  })
}

export async function updateUser(userId, update){
  await DB.query(User.findByIdAndUpdate(userId, update))
}

export async function deleteUser(userId){
  await updateUser(userId, {deleted: true})
}

//permanent investment 
export async function addPermanentInvestmentAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"permanentInvestment.amount": amount}}))
}

export async function deductPermanentInvestmentAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"permanentInvestment.amount": -amount}}))
}

export async function addPermanentInvestmentUnits(userId, units){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"permanentInvestment.units": units}}))
}

export async function deductPermanentInvestmentUnits(userId, units){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"permanentInvestment.units": -units}}))
}

export async function setPermanentInvestmentUnitsDate(userId, permanentInvestmentUnitsDate){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$set: {"permanentInvestment.unitsDate": permanentInvestmentUnitsDate}}))
}

//temporary investment 
export async function addTemporaryInvestmentAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"temporaryInvestment.amount": amount}}))
}

export async function deductTemporaryInvestmentAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"temporaryInvestment.amount": -amount}}))
}

export async function addTemporaryInvestmentUnits(userId, units){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"temporaryInvestment.units": units}}))
}

export async function deductTemporaryInvestmentUnits(userId, units){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {"temporaryInvestment.units": -units}}))
}

export async function setTemporaryInvestmentUnitsDate(userId, temporaryInvestmentUnitsDate){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$set: {"temporaryInvestment.unitsDate": temporaryInvestmentUnitsDate}}))
}

//helpers
function _buildUser(user){
  const password = PasswordUtil.generatePassword()
  const hashedPassword = PasswordUtil.generateHashedPassword(password)
  
  user = {...user,
    membershipDate: Date.now(),
    investmentAmount: 0,
    tempSavingsAmount: 0,
    points: 500,
    active: true,
    password: hashedPassword
  }

  return user
}