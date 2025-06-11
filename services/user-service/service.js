import { User } from "./models.js"

//utils
import * as DB from "../../utils/db-util.js"
import * as ErrorUtil from "../../utils/error-util.js"
import * as PasswordUtil from "../../utils/password-util.js"

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
  if (!user) throw new ErrorUtil.NotFoundError("Failed to find user");
  return user
}

export async function getUserByEmail(email){
  const user = DB.query(await User.findOne({email, deleted: false}))
  if (!user) throw new ErrorUtil.NotFoundError("Failed to find user");
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

export async function getInvestmentAmount(userId){
  const user = await getUserById()
  return user.investmentAmount
}

export async function getTempSavingsAmount(userId){
  const user = await getUserById()
  return user.tempSavingsAmount
}

export async function setInvestmentAmount(userId, investmentAmount){
  const result = DB.query(User.updateOne({_id: userId}, {investmentAmount}))
  if (result.matchedCount === 0){
    throw new ErrorUtil.NotFoundError("Failed to find user")
  }
}

export async function setTempSavingsAmount(userId, tempSavingsAmount){
  const result = DB.query(User.updateOne({_id: userId}, {tempSavingsAmount}))
  if (result.matchedCount === 0){
    throw new ErrorUtil.NotFoundError("Failed to find user")
  }
}

export async function addInvestmentAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {investmentAmount: amount}}))
}

export async function deductInvestmentAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {investmentAmount: -amount}}))
}

export async function addTempSavingsAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {tempSavingsAmount: amount}}))
}

export async function deductTempSavingsAmount(userId, amount){
  await DB.query(User.findOneAndUpdate({_id: userId}, {$inc: {tempSavingsAmount: -amount}}))
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