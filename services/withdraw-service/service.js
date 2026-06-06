import path from 'path';
import { fileURLToPath } from 'url';

import { Withdraw } from "./models.js"
import * as Schemas from "./schemas.js"

//Utils
import * as Errors from "../../utils/error-util.js"
import * as DB from "../../utils/db-util.js"
import * as EJSUtil from "../../utils/ejs-util.js"
import * as Validator from "../../utils/validator-util.js"
import * as DateUtil from "../../utils/date-util.js"

//Collaborator services
import * as CashLocationService from "../cash-location-service/service.js"
import * as UserService from "../user-service/service.js"
import * as EmailService from "../email-service/service.js"

const modulePath = fileURLToPath(import.meta.url)
const moduleDirectory = path.dirname(modulePath)

export async function getWithdraws(filter, sort, pagination){
  Validator.schema(Schemas.getWithdraws, {filter, sort, pagination})
  return await DB.query(Withdraw.getWithdraws(filter, sort, pagination))
}

export async function getWithdrawById(withdrawId){
  Validator.schema(Schemas.getWithdrawById, withdrawId)
  const withdraw = await DB.query(Withdraw.findById(withdrawId))
  if (!withdraw) {throw new Errors.NotFoundError("Failed to find withdraw");}
  return withdraw
}

export async function recordWithdraw(withdraw){
  Validator.schema(Schemas.recordWithdraw, withdraw)
  const { _id: userId } = withdraw.withdrawnBy
  let user
  await DB.transaction(async()=> {
    user = await UserService.getUserById(userId)
    await CashLocationService.addToCashLocation(withdraw.cashLocation._id, - withdraw.amount)
    await Withdraw.create(withdraw)
    const investmentAmount = user.temporaryInvestment.amount
    const {unitsDate} = user.temporaryInvestment
    const newUnitsDate = DateUtil.getToday()
    const investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: -withdraw.amount, deltaAmount: -withdraw.amount, startDate: withdraw.date, endDate: newUnitsDate}
    ]
    await _updateTemporaryInvestment(userId, investmentUpdates)
  })
}

export async function updateWithdraw(withdrawId, update){
  Validator.schema(Schemas.updateWithdraw, { withdrawId, update })

  let user, withdraw

  await DB.transaction(async()=> {
    withdraw = await getWithdrawById(withdrawId)
    if(!update.date) {update.date = withdraw.date}
    if(!update.cashLocationToAdd) {update.cashLocationToAdd = withdraw.cashLocation}
    if(!update.cashLocationToDeduct) {update.cashLocationToDeduct = withdraw.cashLocation}

    user = await UserService.getUserById(withdraw.withdrawnBy._id)
    await CashLocationService.addToCashLocation(update.cashLocationToAdd._id, withdraw.amount)
    await CashLocationService.addToCashLocation(update.cashLocationToDeduct._id, -update.amount)

    await Withdraw.updateOne({_id: withdrawId}, {
      $set: {
        amount: update.amount,
        date: update.date,
        cashLocation: update.cashLocationToDeduct
      }
    })

    const investmentAmount = user.temporaryInvestment.amount
    const {unitsDate} = user.temporaryInvestment
    const newUnitsDate = DateUtil.getToday()

    const investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: withdraw.amount, deltaAmount: withdraw.amount, startDate: withdraw.date, endDate: newUnitsDate},
      {amount: -update.amount, deltaAmount: -update.amount, startDate: update.date, endDate: newUnitsDate}
    ]
    
    await _updateTemporaryInvestment(user._id, investmentUpdates)
    
  })

  sendWithdrawUpdatedEmail(withdraw, update, user)
}

export async function deleteWithdraw(withdrawId, cashLocationToAddId){
  Validator.schema(Schemas.deleteWithdraw, {withdrawId, cashLocationToAddId})

  let user, withdraw

  await DB.transaction(async()=>{
    withdraw = await getWithdrawById(withdrawId)
    if(!cashLocationToAddId) {cashLocationToAddId = withdraw.cashLocation._id;}
    user = await UserService.getUserById(withdraw.withdrawnBy._id)
    await CashLocationService.addToCashLocation(cashLocationToAddId, withdraw.amount)
    await withdraw.deleteOne()

    const newUnitsDate = DateUtil.getToday()
    const investmentAmount = user.temporaryInvestment.amount
    const {unitsDate} = user.temporaryInvestment
    const investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: withdraw.amount, deltaAmount: withdraw.amount, startDate: withdraw.date, endDate: newUnitsDate},
    ]

    await _updateTemporaryInvestment(user._id, investmentUpdates)

  })

  sendWithdrawDeletedEmail(withdraw, user)
}

export async function sendWithdrawRecordedEmail(withdraw, user){
  const emailTemplate = path.join(moduleDirectory, "email-templates/withdraw-recorded.ejs")

  const message = await EJSUtil.renderTemplate(emailTemplate, withdraw)

  EmailService.sendEmail(
    "growthspring",
    user.email,
    "Withdraw Recorded",
    message
  )
}

export async function sendWithdrawUpdatedEmail(currentWithdraw, updatedWithdraw, user){
  const emailTemplate = path.join(moduleDirectory, "email-templates/withdraw-updated.ejs")

  const message = await EJSUtil.renderTemplate(emailTemplate, currentWithdraw, updatedWithdraw)

  EmailService.sendEmail(
    "growthspring",
    user.email,
    "Withdraw Updated",
    message
  )
}

export async function sendWithdrawDeletedEmail(withdraw, user){
  const emailTemplate = path.join(moduleDirectory, "email-templates/withdraw-deleted.ejs")

  const message = await EJSUtil.renderTemplate(emailTemplate, withdraw)

  EmailService.sendEmail(
    "growthspring",
    user.email,
    "Withdraw Deleted",
    message
  )
}

//Helpers
async function _updateTemporaryInvestment(userId, updates){
  const newUnitsDate = updates[0].endDate
  const {totalDeltaAmount, totalDeltaUnits} = _calculateInvestmentUpdate(updates)
  await UserService.updateTemporaryInvestment(userId, {
    deltaAmount: totalDeltaAmount,
    deltaUnits: totalDeltaUnits,
    newUnitsDate
  })
}

function _calculateInvestmentUpdate(updates){
  let totalDeltaUnits = 0
  let totalDeltaAmount = 0
  for(const update of updates){
    let {amount, deltaAmount, startDate, endDate} = update
    startDate = new Date(startDate)
    endDate = new Date(endDate)
    if (startDate > endDate) {throw new Errors.InternalServerError("startDate can not be greater than endDate");}
    const days = DateUtil.getDaysDifference(startDate, endDate)
    totalDeltaUnits +=  amount * days
    totalDeltaAmount += deltaAmount
  }

  return {totalDeltaAmount, totalDeltaUnits}
}