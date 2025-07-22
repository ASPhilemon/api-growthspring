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
  await DB.query(User.updateOne({_id: userId}, update))
}

export async function deleteUser(userId){
  await updateUser(userId, {deleted: true})
}

export async function updatePermanentInvestment(userId, {deltaAmount, deltaUnits, newUnitsDate}){
  let update = {$set: {}, $inc: {}}
  if (newUnitsDate) update.$set["permanentInvestment.unitsDate"] = newUnitsDate
  if (deltaAmount) update.$inc["permanentInvestment.amount"] = deltaAmount
  if (deltaUnits) update.$inc["permanentInvestment.units"] = deltaUnits
  await DB.query(User.updateOne({_id: userId}, update))
}

export async function updateTemporaryInvestment(userId, {deltaAmount, deltaUnits, newUnitsDate}){
  let update = {$set: {}, $inc: {}}
  if (newUnitsDate) update.$set["temporaryInvestment.unitsDate"] = newUnitsDate
  if (deltaAmount) update.$inc["temporaryInvestment.amount"] = deltaAmount
  if (deltaUnits) update.$inc["temporaryInvestment.units"] = deltaUnits

  await DB.query(User.updateOne({_id: userId}, update))
}

export async function addPoints(userId, points){
  await User.updateOne({_id: userId}, {$inc: {points}})
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