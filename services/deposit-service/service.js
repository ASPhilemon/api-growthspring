import path from 'path';
import { fileURLToPath } from 'url';

//Models
import { Deposit, YearlyDeposit } from "./models.js"

//Util
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator-util.js"
import * as DateUtil from "../../utils/date-util.js"
import * as EJSUtil from "../../utils/ejs-util.js"

//Validation Schemas
import * as Schemas from "./schemas.js"

//Collaborator services
import * as UserService from "../user-service/service.js"
import * as CashLocationService from "../cash-location-service/service.js"
import * as PointService from "../point-service/service.js"
import * as EmailService from "../email-service/service.js"

const modulePath = fileURLToPath(import.meta.url)
const moduleDirectory = path.dirname(modulePath)

export async function getDeposits(filter, sort, pagination){
  Validator.schema(Schemas.getDeposits, {filter, sort, pagination})
  const deposits = await Deposit.getDeposits(filter, sort, pagination)
  return deposits
}

export async function getDepositById(depositId){
  Validator.schema(Schemas.getDepositById, depositId)
  const deposit = await DB.query(Deposit.findById(depositId))
  if (!deposit) {throw new Errors.NotFoundError("Failed to find deposit")}
  return deposit
}

export async function getYearlyDeposits(){
  return await DB.query(YearlyDeposit.find())
}

export async function recordDeposit(deposit){
  Validator.schema(Schemas.recordDeposit, deposit)
  let user = null
  await DB.transaction(async ()=> {
    const userId = deposit.depositor._id
    user = await UserService.getUserById(userId)
    deposit = _buildDeposit(deposit, user)

    await DB.query(Deposit.create(deposit))

    await CashLocationService.addToCashLocation(deposit.cashLocation._id, deposit.amount)

    const investmentAmount = deposit.type === "Permanent"? user.permanentInvestment.amount: user.temporaryInvestment.amount
    const unitsDate = deposit.type === "Permanent"? user.permanentInvestment.unitsDate: user.temporaryInvestment.unitsDate
    const newUnitsDate = DateUtil.getToday()
    const investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: deposit.amount, deltaAmount: deposit.amount, startDate: deposit.date, endDate: newUnitsDate}
    ]
   
    if (deposit.type === "Permanent"){
      await _updatePermanentInvestment(userId, investmentUpdates)
      await _awardPoints(deposit)
      await _recordYearlyDeposit(deposit)
    }
    else{
      await _updateTemporaryInvestment(userId, investmentUpdates)
    }
    
  })

  await sendDepositRecordedEmail(deposit, user)
}

export async function updateDeposit(depositId, update){
  Validator.schema(Schemas.updateDeposit, {depositId, update} )
  let deposit = null, user = null

  await DB.transaction(async()=> {
    deposit = await getDepositById(depositId)
    if(!update.amount) {update.amount = deposit.amount}
    if(!update.date) {update.date = deposit.date}
    if(!update.cashLocationToAdd) {update.cashLocationToAdd = deposit.cashLocation}
    if(!update.cashLocationToDeduct) {update.cashLocationToDeduct = deposit.cashLocation}

    const { _id: userId } = deposit.depositor

    user = await UserService.getUserById(userId)

    await Deposit.updateOne({_id: depositId},
      {
        $set: {
          amount: update.amount,
          date: update.date,
          cashLocation: update.cashLocationToAdd
        }
      }
    )

    const investmentAmount = deposit.type === "Permanent"? user.permanentInvestment.amount: user.temporaryInvestment.amount
    const unitsDate = deposit.type === "Permanent"? user.permanentInvestment.unitsDate: user.temporaryInvestment.unitsDate
    const newUnitsDate = DateUtil.getToday()

    const investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: -deposit.amount, deltaAmount: -deposit.amount, startDate: deposit.date, endDate: newUnitsDate},
      {amount: update.amount, deltaAmount: update.amount, startDate: update.date, endDate: newUnitsDate}
    ]

    if (deposit.type === "Permanent"){
      await _updatePermanentInvestment(userId, investmentUpdates)
      await _updateYearlyDeposit(deposit, update)
      //Skip point transaction update for legacy deposit
      if(deposit.cashLocation) {await _updatePointTransaction(deposit._id, update.amount);}
    }
    else{
      await _updateTemporaryInvestment(userId, investmentUpdates)
    }
  })

  sendDepositUpdatedEmail(deposit, update, user)
  
}

export async function deleteDeposit(depositId, cashLocationToDeductId) {
  Validator.schema(Schemas.deleteDeposit, {depositId, cashLocationToDeductId})

  let deposit = null, user = null
  
  await DB.transaction(async ()=> {
    deposit = await getDepositById(depositId)
    if (!cashLocationToDeductId) {cashLocationToDeductId = deposit.cashLocation._id}

    const { _id: userId } = deposit.depositor
    user = await UserService.getUserById(userId)

    await Deposit.deleteOne({_id: depositId})

    await CashLocationService.addToCashLocation(cashLocationToDeductId, -deposit.amount)

    const newUnitsDate = DateUtil.getToday()
    const investmentAmount = deposit.type === "Permanent"? user.permanentInvestment.amount: user.temporaryInvestment.amount
    const unitsDate = deposit.type === "Permanent"? user.permanentInvestment.unitsDate: user.temporaryInvestment.unitsDate
    const investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: -deposit.amount, deltaAmount: -deposit.amount, startDate: deposit.date, endDate: newUnitsDate},
    ]

    if (deposit.type === "Permanent"){
      await _updatePermanentInvestment(userId, investmentUpdates)
      await _deleteYearlyDeposit(deposit, "delete")
      await PointService.deleteTransactionByRefId(deposit._id)
    }
    else{
      await _updateTemporaryInvestment(userId, investmentUpdates)
    }
  })

  sendDepositDeletedEmail(deposit, user)
}

async function sendDepositRecordedEmail(deposit, user){
  const pointsTempDeposit = 0
  deposit = {
    ...deposit,
    pointsAwarded: deposit.type === "Permanent"? _calculatePoints(deposit.amount) : pointsTempDeposit,
    date: DateUtil.formatDateShortUS(deposit.date),
  }

  user.newWorth = deposit.amount + (deposit.type === "Permanent"? user.permanentInvestment.amount  : user.temporaryInvestment.amount)
  user.newPoints = deposit.pointsAwarded + user.points

  const emailTemplate = path.join(moduleDirectory, "email-templates/deposit-received.ejs")

  const message = await EJSUtil.renderTemplate(emailTemplate, {deposit, user})

  EmailService.sendEmail(
    "growthspring",
    user.email,
    "Deposit Recorded",
    message
  )
}

async function sendDepositUpdatedEmail(currentDeposit, depositUpdate, user){
  const pointsTempDeposit = 0
  currentDeposit.pointsAwarded = currentDeposit.type === "Permanent"? _calculatePoints(currentDeposit.amount): pointsTempDeposit
  depositUpdate.pointsAwarded = depositUpdate.type === "Permanent"? _calculatePoints(depositUpdate.amount): pointsTempDeposit
  const emailTemplate = path.join(moduleDirectory, "email-templates/deposit-updated.ejs")
  const message = await EJSUtil.renderTemplate(emailTemplate, {currentDeposit, depositUpdate})

  EmailService.sendEmail(
    "growthspring",
    user.email,
    "Deposit Updated",
    message
  )
}

async function sendDepositDeletedEmail(deposit, user){
  const pointsTempDeposit = 0
  deposit.pointsAwarded = deposit.type === "Permanent"? _calculatePoints(deposit.amount) : pointsTempDeposit
  const emailTemplate = path.join(moduleDirectory, "email-templates/deposit-deleted.ejs")
  const message = await EJSUtil.renderTemplate(emailTemplate, deposit)

 EmailService.sendEmail(
    "growthspring",
    user.email,
    "Deposit Deleted",
    message
  )
}

//Helper functions
export function _calculatePoints(depositAmount){
  const points = 3, unitDeposit = 10000
  return Math.floor((depositAmount / unitDeposit) * points)
}

async function _awardPoints(deposit){
  const points = _calculatePoints(deposit.amount)
  const userId = deposit.depositor._id
  const reason = "Deposit"
  const refId = deposit._id
  await PointService.awardPoints(userId, points, reason, refId)
}

function _buildDeposit(deposit, user){
  deposit.pointsBefore = user.points
  if (deposit.type === "Permanent"){
    deposit.balanceBefore = user.permanentInvestment.amount
  }
  else{
    deposit.balanceBefore = user.temporaryInvestment.amount
  }

  return deposit
}

async function _recordYearlyDeposit(deposit) {
  const depositDate = new Date(deposit.date);
  const year = depositDate.getFullYear();
  const month = depositDate.getMonth();

  const yearlyDeposit = await DB.query(YearlyDeposit.findOne({year}))

  if (yearlyDeposit){
    await DB.query(YearlyDeposit.updateOne({ year }, {
      $set: {
        total: yearlyDeposit.total + deposit.amount,
        [`monthTotals.${month}`]: yearlyDeposit.monthTotals[month] + deposit.amount
      }
    }))
  }
  else{
    const months = 12
    const defaultMonthDeposit = 0
    const monthTotals = new Array(months).fill(defaultMonthDeposit)
    monthTotals[month] = deposit.amount
    await DB.query(
      YearlyDeposit.create({
        year,
        total: deposit.amount,
        monthTotals
      })
    )
  }

}

async function _updateYearlyDeposit(currentDeposit, depositUpdate) {
  currentDeposit = {...currentDeposit.toObject(), amount: -currentDeposit.amount}
  await _recordYearlyDeposit(currentDeposit)
  await _recordYearlyDeposit(depositUpdate)
}

async function _deleteYearlyDeposit(deposit) {
  deposit = {...deposit.toObject(), amount: -deposit.amount}
  await _recordYearlyDeposit(deposit)
}

async function _updatePointTransaction(depositId, newDepositAmount){
  const newPoints =  _calculatePoints(newDepositAmount)
  await PointService.findByRefIdAndUpdatePoints(depositId, newPoints)
}

async function _updateTemporaryInvestment(userId, updates){
  const [currentInvestmentUpdate] = updates
  const newUnitsDate = currentInvestmentUpdate.endDate
  const {totalDeltaAmount, totalDeltaUnits} = _calculateInvestmentUpdate(updates)
  await UserService.updateTemporaryInvestment(userId, {
    deltaAmount: totalDeltaAmount,
    deltaUnits: totalDeltaUnits,
    newUnitsDate
  })
}

async function _updatePermanentInvestment(userId, updates){
  const [currentInvestmentUpdate] = updates
  const newUnitsDate = currentInvestmentUpdate.endDate
  const {totalDeltaAmount, totalDeltaUnits} = _calculateInvestmentUpdate(updates)
  await UserService.updatePermanentInvestment(userId, {
    deltaAmount: totalDeltaAmount,
    deltaUnits: totalDeltaUnits,
    newUnitsDate
  })
}

function _calculateInvestmentUpdate(updates){
  let totalDeltaUnits = 0
  let totalDeltaAmount = 0
  for(const update of updates){
    const {amount, deltaAmount} = update
    let {startDate, endDate} = update
    startDate = new Date(startDate)
    endDate = new Date(endDate)
    if (startDate > endDate) {throw new Errors.InternalServerError("startDate can not be greater than endDate");}
    const days = DateUtil.getDaysDifference(startDate, endDate)
    totalDeltaUnits +=  amount * days
    totalDeltaAmount += deltaAmount
  }

  return {totalDeltaAmount, totalDeltaUnits}
}