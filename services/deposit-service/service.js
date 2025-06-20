import mongoose from "mongoose"

//model
import { Deposit, YearDeposit } from "./models.js"

//util
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator-util.js"

//validation Schemas
import * as Schemas from "./schemas.js"

//collaborator services
import * as UserServiceManager from "../user-service/service.js"
import * as CashLocationServiceManager from "../cash-location-service/service.js"
import * as PointServiceManager from "../point-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"

export async function getDeposits(filter, sort, pagination){
  Validator.schema(Schemas.getDeposits, {filter, sort, pagination})
  return await Deposit.getDeposits(filter, sort, pagination)
}

export async function getDepositById(depositId){
  Validator.schema(Schemas.getDepositById, depositId)
  const deposit = await DB.query(Deposit.findById(depositId))
  if (!deposit) throw new Errors.NotFoundError("Failed to find deposit")
  return deposit
}

export async function getYearDeposits(){
  return await DB.query(YearDeposit.find())
}

export async function recordDeposit(deposit){
  Validator.schema(Schemas.recordDeposit, deposit)

  const { userId } = deposit.depositor
  const user = await UserServiceManager.getUserById(userId)

  deposit = _buildDeposit(deposit, user.addInvestmentAmount)
  const pointsTransaction = _buildPointsTransaction(
    deposit._id,
    deposit.amount,
    userId,
    user.fullName
  )

  await DB.transaction(async ()=> {
    await DB.query(Deposit.create(deposit))

    await (deposit.type === "club saving"
    ? UserServiceManager.addInvestmentAmount
    : UserServiceManager.addTempSavingsAmount)(userId, deposit.amount);
    await CashLocationServiceManager.addToCashLocation(deposit.cashLocation._id, deposit.amount)
    deposit.type ==="club deposit" &&
    await PointServiceManager.recordTransaction(pointsTransaction)
    await _recordYearDeposit(deposit.date, deposit.amount)
  })
  
  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: user.email,
    subject: "Deposit Recorded",
    message: "Your deposit has been recorded."
  })
}

export async function setDepositAmount(depositId, newAmount){
  Validator.schema(Schemas.setDepositAmount, {depositId, newAmount} )

  const deposit = await getDepositById(depositId)

  const { _id: userId } = deposit.depositor

  await DB.transaction(async()=> {
    await (deposit.type === "club saving"
    ? UserServiceManager.addInvestmentAmount
    : UserServiceManager.addTempSavingsAmount)(newAmount - deposit.amount)
    await DB.query(Deposit.updateOne({_id: userId}, {amount: newAmount}))
    await _updateYearDepositAmount(deposit.date, newAmount - deposit.amount)
    await _updatePointTransaction(deposit._id, newAmount)
  })

  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: deposit.depositor.email,
    subject: "Deposit Updated",
    message: "Your deposit has been updated"
  })
}

export async function deleteDeposit(depositId) {
  Validator.schema(Schemas.deleteDeposit, depositId)

  const deposit = await getDeposit(depositId)
  const { _id: userId } = deposit.depositor
  const { _id: cashLocationId } = deposit.cashLocation

  await DB.transaction(async ()=> {
    await (deposit.type === "club saving"
    ? UserServiceManager.deductInvestmentAmount
    : UserServiceManager.deductTempSavingsAmount)(userId, deposit.amount);

    await CashLocationServiceManager.deductFromCashLocation(cashLocationId, deposit.amount),
    await DB.query(Deposit.updateOne({ _id: depositId }, {deleted: true})),
    await _deleteYearDeposit(deposit.date, deposit.amount)
    await PointServiceManager.deleteTransaction({"reason._id": deposit._id})
  })

  EmailServiceManager.sendEmail({
    sender: "growthspring",
    recipient: deposit.depositor.email,
    subject: "Deposit Deleted",
    message: "Your deposit has been deleted"
  })
}

//helper functions
function _calculatePointsReward(depositAmount){
  return Math.floor((depositAmount / 10000)*3)
}

function _buildPointsTransaction(depositId, depositAmount, userId, userFullName){
   const pointsTransaction = {
    type: "reward",
    recipient: {_id: userId, fullName: userFullName},
    points: _calculatePointsReward(depositAmount),
    reason: {_id: depositId, description: "Reward for club deposit"}
  }

  return pointsTransaction
}

function _buildDeposit(deposit, balanceBefore){
  deposit.balanceBefore = balanceBefore
  deposit._id = new mongoose.Types.ObjectId()
  return deposit
}

async function _recordYearDeposit(date, amount) {
  date = new Date(date);
  const year = date.getFullYear();
  const month = date.getMonth();

  const monthField = `monthTotals.${month}`;

  await DB.query(YearDeposit.updateOne(
    { year },
    {
      $inc: {
        total: amount,
        [monthField]: amount
      },
      $setOnInsert: {
        monthTotals: Array(12).fill(0),
      }
    },
    { upsert: true }
  ));
}

async function _updateYearDepositAmount(date, deltaAmount) {
  if (deltaAmount === 0) return;

  date = new Date(date);
  const year = date.getFullYear();
  const month = date.getMonth();

  const monthField = `monthTotals.${month}`;

  const result = await DB.query(YearDeposit.updateOne(
    { year },
    {
      $inc: {
        total: deltaAmount,
        [monthField]: deltaAmount
      }
    }
  ));

  if (result.matchedCount === 0) {
    throw new Errors.BadRequestError(`No year deposit record found for year ${year}`);
  }
}

async function _deleteYearDeposit(date, amount) {
  date = new Date(date);
  const year = date.getFullYear();
  const month = date.getMonth();

  const monthField = `monthTotals.${month}`;

  const result = await DB.query(YearDeposit.updateOne(
    { year },
    {
      $inc: {
        total: -amount,
        [monthField]: -amount
      }
    }
  ));

  if (result.matchedCount === 0) {
    throw new Errors.BadRequestError(`No year deposit record found for year ${year}`);
  }
}

async function _updatePointTransaction(depositId, newDepositAmount){
  const newPoints =  _calculatePointsReward(newDepositAmount)
  await PointServiceManager.setPoints({"reason._id": depositId}, newPoints)
}
