import { Withdraw } from "./models.js"

//utils
import * as Errors from "../../utils/error-util.js"
import * as DB from "../../utils/db-util.js"

//collaborator services
import * as CashLocationServiceManager from "../cash-location-service/service.js"
import * as UserServiceManager from "../user-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"

export async function getWithdraws(){
  return await DB.query(Withdraw.find())
}

export async function getWithdrawById(withdrawId){
  const withdraw = await DB.query(Withdraw.findById(withdrawId))
  if (!withdraw) throw new Errors.NotFoundError("Failed to find withdraw record");
  return withdraw
}

export async function recordWithdraw(withdraw, cashLocations){
  const { _id: userId } = withdraw.withdrawnBy
  const user = await UserServiceManager.getUserById(userId)
 
  _validateCashLocationsAmount(withdraw.amount, cashLocations)
  _validateWithdrawAmount(withdraw.amount, user.tempSavingsAmount)
 
  await DB.transaction(async()=>{
    await DB.query(Withdraw.create(withdraw))
    await UserServiceManager.deductTempSavingsAmount(userId, withdraw.amount)
    await _deductFromCashLocations(cashLocations)
  })

  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: user.email,
    subject: "Withdraw Alert",
    message: `UGX ${withdraw.amount} has been withdrawn from your temporary savings account.`
  })
}

export async function updateWithdrawAmount(withdrawId, newAmount, newCashLocations){
  const withdraw = await getWithdrawById(withdrawId)
  const {_id : userId} = withdraw.withdrawnBy
  const user = UserServiceManager.getUserById(userId)

  const tempSavingsAmount = user.tempSavingsAmount + withdraw.amount
  _validateWithdrawAmount(newAmount, tempSavingsAmount)
  _validateCashLocationsAmount(newAmount, newCashLocations)

  await DB.transaction(async()=> {
    await DB.query(Withdraw.findByIdAndDelete(withdrawId, {amount: newAmount, cashLocations: newCashLocations}))
    await _updateCashLocations(withdraw.cashLocations, newCashLocations)
    await UserServiceManager.setTempSavingsAmount(userId, tempSavingsAmount - newAmount )
  })

  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: user.email,
    subject: "Withdraw Update",
    message: `Your withdraw made on ${"date"} has been updated`
  })
}

export async function deleteWithdraw(withdrawId){
  const withdraw = getWithdrawById(withdrawId)

  await DB.transaction(async()=>{
    await Withdraw.findByIdAndUpdate(withdraw._id, {deleted: true})
    await UserServiceManager.addTempSavingsAmount(withdraw.amount)
    await _addToCashLocations(withdraw.cashLocations)
  })

  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: user.email,
    subject: "Withdraw Deleted",
    message: `Your withdraw made on ${"date"} has been deleted`
  })
}


//helpers
function _validateWithdrawAmount(withdrawAmount, tempSavingsAmount){
  //check if user has enough temporary savings
  if (tempSavingsAmount < withdrawAmount){
    throw new Errors.BadRequestError(`
    There is not enough temporary savings in the users account to complete this
    withdraw. Maximum amount for this user is ${tempSavingsAmount}`)
  }
}

function _validateCashLocationsAmount(withdrawAmount, cashLocations){
  //check if total amount in cash locations equals the withdraw amount
  if (_calculateTotalInCashLocations(cashLocations) !== withdrawAmount){
    throw new Errors.BadRequestError("Total amount in cash locations should equal the withdraw amount")
  }
}

function _calculateTotalInCashLocations(cashLocations){
  const total = cashLocations.reduce((acc, curr)=> curr.amount + acc, 0)
  return total
}

async function _deductFromCashLocations(cashLocations){
  for (let cashLocation of cashLocations){
    let {_id : cashLocationId, amount} = cashLocation
    await CashLocationServiceManager.addToCashLocation(cashLocationId, -amount)
  }
}

async function _addToCashLocations(cashLocations){
  for (let cashLocation of cashLocations){
    let {_id : cashLocationId, amount} = cashLocation
    await CashLocationServiceManager.addToCashLocation(cashLocationId, amount)
  }
}

async function _updateCashLocations(oldCashLocations, newCashLocations){
  await _addToCashLocations(oldCashLocations)
  await _deductFromCashLocations(newCashLocations)
}