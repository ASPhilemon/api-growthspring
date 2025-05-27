//model
import { Deposit } from "./models.js"

//util
import * as DB from "../../utils/db-util.js"
import * as ErrorUtil from "../../utils/error-util.js"

//collaborator services
import * as UserServiceManager from "../user-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"
import * as CashLocationServiceManager from "../cash-location-service/service.js"

export async function getDeposits({ filter, sort, pagination }){
  return await Deposit.getDeposits({filter, sort, pagination})
}

export async function getDeposit(depositId){
  const deposit = await DB.query(Deposit.findById(depositId))
  if (!deposit) throw new ErrorUtil.NotFoundError("Failed to find deposit")
  return deposit
}

export async function createDeposit(deposit){
  //get user
  const { userId } = deposit.depositor
  const user = await UserServiceManager.getUserById(userId)

  //add field balance before to deposit
  deposit.balanceBefore = user.investmentAmount

  await DB.transaction(async ()=>{
    await DB.query(Deposit.create(deposit))

    await (deposit.type === "club saving"
    ? UserServiceManager.addInvestmentAmount
    : UserServiceManager.addTempSavingsAmount)(userId, deposit.amount);

    await CashLocationServiceManager.addToCashLocation(deposit.cashLocationId, deposit.amount)
  })
  
  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: user.email,
    subject: "Deposit Recorded",
    message: "Your deposit has been recorded."
  })
}

export async function setAmount(depositId, newAmount){
  const deposit = await getDeposit(depositId)

  const { _id: userId } = deposit.depositor

  await DB.transaction(async()=> {
    await (deposit.type === "club saving"
    ? UserServiceManager.addInvestmentAmount
    : UserServiceManager.addTempSavingsAmount)(newAmount - deposit.amount)
    await DB.query(Deposit.updateOne({_id: userId}, {amount: newAmount}))
  })

  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: deposit.depositor.email,
    subject: "Deposit Updated",
    message: "Your deposit has been updated"
  })
}

export async function deleteDeposit(depositId) {
  const deposit = await getDeposit(depositId)
  const { _id: userId } = deposit.depositor
   const { amount } = deposit
  const { _id: cashLocationId } = deposit.cashLocation

  await DB.transaction(async ()=> {
    await (deposit.type === "club saving"
    ? UserServiceManager.deductInvestmentAmount
    : UserServiceManager.deductTempSavingsAmount)(userId, amount);

    await CashLocationServiceManager.deductFromCashLocation(cashLocationId, deposit.amount),
    await DB.query(Deposit.updateOne({ _id: depositId }, {deleted: true}))
  })

  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: deposit.depositor.email,
    subject: "Deposit Deleted",
    message: "Your deposit has been deleted"
  })

}
