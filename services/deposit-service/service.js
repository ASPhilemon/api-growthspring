//model
import { Deposit } from "./models.js"

//util
import * as DB from "../../utils/db-util.js"

//collaborator services
import * as UserServiceManager from "../user-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"
import * as CashLocationServiceManager from "../cash-location-service/service.js"

export async function getDeposits({ filter, sort, pagination }){
  return await Deposit.getDeposits({filter, sort, pagination})
}

export async function getDeposit(depositId){
  const deposit = await DB.query(Deposit.findById(depositId))
  const statusCode = 400
  if (!deposit) throw new ErrorUtil.AppError("Failed to find deposit", statusCode)
  return deposit
}

export async function createDeposit(deposit){
  //get user
  const { userId } = deposit.depositor
  const user = await UserServiceManager.getUser(userId)

  //add field balance before to deposit
  deposit.balance_before = user.investmentAmount

  const userUpdate = { investmentAmount : user.investmentAmount + deposit.amount }
  
  await Promise.all([
    DB.query(Deposit.create(deposit)),
    UserServiceManager.updateUser(user._id, userUpdate),
    CashLocationServiceManager.addToCashLocation(deposit.cashLocationId, deposit.amount)
  ])
  
  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: user.email,
    subject: "Deposit Recorded",
    message: "Your deposit has been recorded."
  })
}

export async function updateDeposit(depositId, update){
  const deposit = await getDeposit(depositId)

  const { _id: userId } = deposit.depositor
  const user = await UserServiceManager.getUser(userId)

  //update user and deposit
  const investmentAmountUpdate = user.investmentAmount - deposit.amount + update.amount
  const userUpdate = {investmentAmount: investmentAmountUpdate  }

  await Promise.all([
    UserServiceManager.updateUser(userId, userUpdate ),
    DB.query(Deposit.updateOne({ _id: deposit._id }, update))
  ])
}

export async function deleteDeposit(depositId) {
  const deposit = await getDeposit(depositId)

  const { _id:userId } = deposit.depositor
  const user = await UserServiceManager.getUser(userId)
    
  const updatedInvestmentAmount = user.investmentAmount - deposit.amount
  const userUpdate = { investmentAmount: updatedInvestmentAmount }
  const { cashLocationId } = deposit.cashLocation

  await Promise.all([
    UserServiceManager.updateUser(userId, userUpdate),
    CashLocationServiceManager.deductFromCashLocation(cashLocationId, deposit.amount),
    DB.query(Deposit.deleteOne({ _id: depositId }))
  ])
}
