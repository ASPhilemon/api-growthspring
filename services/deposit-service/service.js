import path from 'path';
import { fileURLToPath } from 'url';

//models
import { Deposit, YearlyDeposit } from "./models.js"

//util
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator-util.js"
import * as DateUtil from "../../utils/date-util.js"
import * as EJSUtil from "../../utils/ejs-util.js"

//validation Schemas
import * as Schemas from "./schemas.js"

//collaborator services
import * as UserServiceManager from "../user-service/service.js"
import * as CashLocationServiceManager from "../cash-location-service/service.js"
import * as PointServiceManager from "../point-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"

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
  if (!deposit) throw new Errors.NotFoundError("Failed to find deposit")
  return deposit
}

export async function getYearlyDeposits(){
  return await DB.query(YearlyDeposit.find())
}

export async function recordDeposit(deposit){
  Validator.schema(Schemas.recordDeposit, deposit)
  let user
  await DB.transaction(async ()=> {
    const userId = deposit.depositor._id
    user = await UserServiceManager.getUserById(userId)
    deposit = _buildDeposit(deposit, user)

    await DB.query(Deposit.create(deposit))

    await CashLocationServiceManager.addToCashLocation(deposit.cashLocation._id, deposit.amount)

    let investmentAmount = deposit.type == "Permanent"? user.permanentInvestment.amount: user.temporaryInvestment.amount
    let unitsDate = deposit.type == "Permanent"? user.permanentInvestment.unitsDate: user.temporaryInvestment.unitsDate
    let newUnitsDate = DateUtil.getToday()
    let investmentUpdates = [
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

  sendDepositRecordedEmail(deposit, user)
}

export async function updateDeposit(depositId, update){
  Validator.schema(Schemas.updateDeposit, {depositId, update} )

  let deposit, user

  await DB.transaction(async()=> {
    deposit = await getDepositById(depositId)

    if(deposit.recordedBy._id != update.updatedById){
      throw new Errors.NotAllowedError("Can not update a deposit that was recorded by another admin")
    } 

    const { _id: userId } = deposit.depositor

    user = await UserServiceManager.getUserById(userId)

    await DB.query(Deposit.updateOne({_id: depositId},{
      amount: update.amount,
      date: update.date,
      cashLocation: update.cashLocationToAdd
    }))

    await CashLocationServiceManager.addToCashLocation(update.cashLocationToAdd._id, update.amount)
    await CashLocationServiceManager.addToCashLocation(update.cashLocationToDeduct._id, deposit.amount)

    let investmentAmount = deposit.type == "Permanent"? user.permanentInvestment.amount: user.temporaryInvestment.amount
    let unitsDate = deposit.type == "Permanent"? user.permanentInvestment.unitsDate: user.temporaryInvestment.unitsDate
    let newUnitsDate = DateUtil.getToday()

    let investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: -deposit.amount, deltaAmount: -deposit.amount, startDate: deposit.date, endDate: newUnitsDate},
      {amount: update.amount, deltaAmount: update.amount, startDate: update.date, endDate: newUnitsDate}
    ]

    if (deposit.type === "Permanent"){
      await _updatePermanentInvestment(userId, investmentUpdates)
      await _updateYearlyDeposit(deposit, update)
      await _updatePointTransaction(deposit._id, update.amount)
    }
    else{
      await _updateTemporaryInvestment(userId, investmentUpdates)
    }
  })

  sendDepositUpdatedEmail(deposit, update, user)
  
}

export async function deleteDeposit(depositId, cashLocationToDeductId) {
  Validator.schema(Schemas.deleteDeposit, {depositId, cashLocationToDeductId})

  let deposit, user
  
  await DB.transaction(async ()=> {
    deposit = await getDepositById(depositId)

    const { _id: userId } = deposit.depositor
    user = await UserServiceManager.getUserById(userId)

    await Deposit.deleteOne({_id: depositId})

    await CashLocationServiceManager.addToCashLocation(cashLocationToDeductId, -deposit.amount)

    let newUnitsDate = DateUtil.getToday()
    let investmentAmount = deposit.type == "Permanent"? user.permanentInvestment.amount: user.temporaryInvestment.amount
    let unitsDate = deposit.type == "Permanent"? user.permanentInvestment.unitsDate: user.temporaryInvestment.unitsDate
    let investmentUpdates = [
      {amount: investmentAmount, deltaAmount: 0, startDate: unitsDate, endDate: newUnitsDate},
      {amount: -deposit.amount, deltaAmount: -deposit.amount, startDate: deposit.date, endDate: newUnitsDate},
    ]

    if (deposit.type == "Permanent"){
      await _updatePermanentInvestment(userId, investmentUpdates)
      await _recordYearlyDeposit(deposit, "delete")
      await PointServiceManager.deleteTransactionByRefId(deposit._id)
    }
    else{
      await _updateTemporaryInvestment(userId, investmentUpdates)
    }
  })

  sendDepositDeletedEmail(deposit, user)
}

async function sendDepositRecordedEmail(deposit, user){
  deposit.pointsAwarded = deposit.type == "Permanent"? _calculatePoints(deposit.amount) : 0

  let emailTemplate = path.join(moduleDirectory, "email-templates/deposit-received.ejs")

  let message = await EJSUtil.renderTemplate(emailTemplate, deposit)

  EmailServiceManager.sendEmail(
    "growthspring",
    user.email,
    "Deposit Recorded",
    message
  )
}

async function sendDepositUpdatedEmail(currentDeposit, updatedDeposit, user){
  currentDeposit.pointsAwarded = currentDeposit.type == "Permanent"? _calculatePoints(currentDeposit.amount): 0
  updatedDeposit.pointsAwarded = updatedDeposit.type == "Permanent"? _calculatePoints(updatedDeposit.amount): 0
  let emailTemplate = path.join(moduleDirectory, "email-templates/deposit-updated.ejs")
  let message = await EJSUtil.renderTemplate(emailTemplate, currentDeposit, updateDeposit)

  EmailServiceManager.sendEmail(
    "growthspring",
    user.email,
    "Deposit Updated",
    message
  )
}

async function sendDepositDeletedEmail(deposit, user){
  deposit.pointsAwarded = deposit.type == "Permanent"? _calculatePoints(deposit.amount) : 0
  let emailTemplate = path.join(moduleDirectory, "email-templates/deposit-deleted.ejs")
  let message = await EJSUtil.renderTemplate(emailTemplate, deposit)

 EmailServiceManager.sendEmail(
    "growthspring",
    user.email,
    "Deposit Deleted",
    message
  )
}

//helper functions
function _calculatePoints(depositAmount){
  return Math.floor((depositAmount / 10000)*3)
}

async function _awardPoints(deposit){
  let points = _calculatePoints(deposit.amount)
  let userId = deposit.depositor._id
  let reason = "Deposit"
  let refId = deposit._id
  await PointServiceManager.awardPoints(userId, points, reason, refId)
}

function _buildDeposit(deposit, user){
  deposit.pointsBefore = user.points
  if (deposit.type == "Permanent"){
    deposit.balanceBefore = user.permanentInvestment.amount
  }
  else{
    deposit.balanceBefore = user.temporaryInvestment.amount
  }

  return deposit
}

async function _recordYearlyDeposit(deposit, type = "create") {
  let depositDate = new Date(deposit.date);
  const year = depositDate.getFullYear();
  const month = depositDate.getMonth();

  const monthField = `monthTotals.${month}`;

  const depositAmount = type == "create"? deposit.amount: - deposit.amount

  let result = await DB.query(YearlyDeposit.updateOne(
    { year },
    {
    $inc: {
      total: depositAmount,
      [monthField]: depositAmount
    },

  }))

  if (result.matchedCount == 0){
    console.log("zero match count here")
    let monthTotals = new Array(12).fill(0)
    monthTotals[month] = depositAmount
    YearlyDeposit.create({
      year,
      total: depositAmount,
      monthTotals
    })
  }

}

async function _updateYearlyDeposit(currentDeposit, depositUpdate) {
  let currentDepositDate = new Date(currentDeposit.date);
  let depositUpdateDate = new Date(depositUpdate.date);

  const monthFieldCurrent = `monthTotals.${currentDepositDate.getMonth()}`;
  const monthFieldUpdate = `monthTotals.${depositUpdateDate.getMonth()}`;

  await DB.query(YearlyDeposit.bulkWrite([
    {
      updateOne: {
        filter: { year: depositUpdateDate.getFullYear()},
        update: {
          $inc: {
            total: depositUpdate.amount,
            [monthFieldUpdate]: depositUpdate.amount
          },
        }
      }
    },

    {
      updateOne: {
        filter: { year: currentDepositDate.getFullYear()},
        update: {
          $inc: {
            total: - currentDeposit.amount,
            [monthFieldCurrent]: - currentDeposit.amount
          },
        }
      }
    }
  ]));
}

async function _updatePointTransaction(depositId, newDepositAmount){
  const newPoints =  _calculatePoints(newDepositAmount)
  await PointServiceManager.findByRefIdAndUpdatePoints(depositId, newPoints)
}

async function _updateTemporaryInvestment(userId, updates){
  let newUnitsDate = updates[0].endDate
  let {totalDeltaAmount, totalDeltaUnits} = _calculateInvestmentUpdate(updates)
  await UserServiceManager.updateTemporaryInvestment(userId, {
    deltaAmount: totalDeltaAmount,
    deltaUnits: totalDeltaUnits,
    newUnitsDate
  })
}

async function _updatePermanentInvestment(userId, updates){
  let newUnitsDate = updates[0].endDate
  let {totalDeltaAmount, totalDeltaUnits} = _calculateInvestmentUpdate(updates)
  await UserServiceManager.updatePermanentInvestment(userId, {
    deltaAmount: totalDeltaAmount,
    deltaUnits: totalDeltaUnits,
    newUnitsDate
  })
}

function _calculateInvestmentUpdate(updates){
  let totalDeltaUnits = 0
  let totalDeltaAmount = 0
  for(let update of updates){
    let {amount, deltaAmount, startDate, endDate} = update
    startDate = new Date(startDate)
    endDate = new Date(endDate)
    if (startDate > endDate) throw new Errors.InternalServerError("startDate can not be greater than endDate");
    let days = DateUtil.getDaysDifference(startDate, endDate)
    totalDeltaUnits +=  amount * days
    totalDeltaAmount += deltaAmount
  }

  return {totalDeltaAmount, totalDeltaUnits}
}