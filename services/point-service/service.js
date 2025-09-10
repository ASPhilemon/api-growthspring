import { PointTransaction } from "./models.js"
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator-util.js"

import * as DateUtil from "../../utils/date-util.js"

//collaborator services
import * as UserServiceManager from "../user-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"

import * as Schemas from "./schemas.js"

export async function getTransactions(filter, sort, pagination){
  return PointTransaction.getTransactions(filter, sort, pagination)
}

export async function getTransactionById(transactionId){
  const transaction =  DB.query(PointTransaction.findById(transactionId))
  if (!transaction) throw new Errors.NotFoundError("Failed to find transaction")
  return transaction
}

export async function getTransactionByRefId(refId){
  const transaction =  DB.query(PointTransaction.findOne({refId}))
  if (!transaction) throw new Errors.NotFoundError("Failed to find transaction")
  return transaction
  return transaction
}

export async function recordTransaction(transaction){
  //Validator.schema(Schemas.recordTransaction, transaction)
  const {type, senderId, recipientId, redeemedById, points, reason, refId} = transaction
  switch(type){
    case "award":
      await awardPoints(recipientId, points, reason, refId)
      break
    case "redeem":
      await redeemPoints(redeemedById, points, reason, refId)
      break
    case "transfer":
      await transferPoints(senderId, recipientId, points, reason)
  }
}

export async function awardPoints(recipientId, points, reason, refId){
  Validator.schema(Schemas.awardPoints, {userId: recipientId, points, reason, refId})
  const recipient = await UserServiceManager.getUserById(recipientId)
  await UserServiceManager.addPoints(recipientId, points)
  await DB.query(PointTransaction.create({
    type: "award",
    recipient: {_id: recipient._id, fullName: recipient.fullName},
    points,
    reason,
    refId,
    date: DateUtil.getToday()
  }))
}

export async function redeemPoints(redeemedById, points, reason, refId){
  Validator.schema(Schemas.redeemPoints, {userId: redeemedById, points, reason, refId})
  const redeemedBy = await UserServiceManager.getUserById(redeemedById)
  await DB.transaction(async()=>{
    await UserServiceManager.addPoints(redeemedById, -points)
    await PointTransaction.create({
      type: "redeem",
      redeemedBy: {_id: redeemedById, fullName: redeemedBy.fullName},
      points,
      reason,
      refId,
      date: DateUtil.getToday()
    })
  })
}

export async function transferPoints(senderId, recipientId, points, reason){
  Validator.schema(Schemas.transferPoints, {senderId, recipientId, points, reason})
  const [sender, recipient] = await Promise.all([
    UserServiceManager.getUserById(senderId),
    UserServiceManager.getUserById(recipientId)
  ])
  await DB.transaction(async()=>{
    await UserServiceManager.addPoints(senderId, -points)
    await UserServiceManager.addPoints(recipientId, points)
    await PointTransaction.create({
      type: "transfer",
      sender: {_id: sender._id, fullName: sender.fullName},
      recipient: {_id: recipient._id, fullName: recipient.fullName},
      points,
      reason,
      date: DateUtil.getToday()
    })
  })
}

export async function deleteTransactionById(transactionId){
  Validator.schema(Schemas.deleteTransactionById, transactionId)
  let transaction = await getTransactionById(transactionId)
  await _deleteTransaction(transaction)
}

export async function deleteTransactionByRefId(refId,){
  Validator.schema(Schemas.deleteTransactionByRefId, refId)
  let transaction = await getTransactionByRefId(refId)
  await _deleteTransaction(transaction)
}

export async function findByRefIdAndUpdatePoints(refId, newPoints){
  Validator.schema(Schemas.findByRefIdAndUpdatePoints, {refId, newPoints})
  let transaction
  await DB.transaction(async ()=>{
    transaction = await getTransactionByRefId(refId)
    await _updatePoints(transaction, newPoints)
  })
  
}

export async function findByIdAndUpdatePoints(transactionId, newPoints){
  Validator.schema(Schemas.findByIdAndUpdatePoints, {transactionId, newPoints})
  let transaction
  await DB.transaction(async ()=>{
    transaction = await getTransactionById(transactionId)
    await _updatePoints(transaction, newPoints)
  })
}

//helpers
async function _deleteTransaction(transaction){
  await DB.transaction(async()=>{
    const {type, recipient, sender, redeemedBy, points} = transaction
    await PointTransaction.deleteOne({_id: transaction._id})
    switch(type){
      case "award":
        await UserServiceManager.addPoints(recipient._id, -points)
        break
      case "redeem":
        await UserServiceManager.addPoints(redeemedBy._id, points)
        break 
      case "transfer":
        await UserServiceManager.addPoints(recipient._id, -points)
        await UserServiceManager.addPoints(sender._id, points)
        break    
    }
  })
}

async function _updatePoints(transaction, newPoints){
  switch(transaction.type){
    case "award":
      await _updatePointsAwardTransaction(transaction, newPoints)
      break
    case "redeem":
      await _updatePointsRedeemTransaction(transaction, newPoints)
      break
    case "transfer":
      await _updatePointsTransferTransaction(transaction, newPoints)
      break
  }
}

async function _updatePointsAwardTransaction(currentTransaction, newPoints){
  const {recipient, points: currentPoints} = currentTransaction
  await UserServiceManager.addPoints(recipient._id, newPoints - currentPoints)
  await PointTransaction.updateOne({_id: currentTransaction._id}, {
    $set: {
      points: newPoints
    }
  })
}

async function _updatePointsRedeemTransaction(currentTransaction, newPoints ){
  const {redeemedBy, points: currentPoints} = currentTransaction
  await UserServiceManager.addPoints(redeemedBy._id, currentPoints - newPoints)
  await PointTransaction.updateOne({_id: currentTransaction._id}, {
    $set: {
      points: newPoints
    }
  })
}

async function _updatePointsTransferTransaction(currentTransaction, newPoints){
  const {sender, recipient, points: currentPoints} = currentTransaction
  await UserServiceManager.addPoints(sender._id, currentPoints - newPoints)
  await UserServiceManager.addPoints(recipient._id, newPoints - currentPoints )
  await PointTransaction.updateOne({_id: currentTransaction._id}, {
    $set: {
      points: newPoints
    }
  })
}