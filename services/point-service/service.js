import { PointTransaction } from "./models.js"
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as Validator from "../../utils/validator-util.js"

//collaborator services
import * as UserServiceManager from "../user-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"

export async function getTransactions(filter){
  return PointTransaction.getTransactions({filter})
}

export async function getTransactionById(transactionId){
  const transaction =  DB.query(PointTransaction.findById(transactionId))
  Validator.assert(transaction, "Failed to find trasaction", {errType:Errors.NotFoundError})
  return transaction
}

export async function getTransactionByRefId(refId){
  const transaction =  DB.query(PointTransaction.findOne({refId}))
  Validator.assert(transaction, "Failed to find transaction", {errType:Errors.NotFoundError})
  return transaction
}

export async function awardPoints(userId, points, reason, refId){
  const user = await UserServiceManager.getUserById(userId)
  await UserServiceManager.addPoints(userId, points)
  await DB.query(PointTransaction.create({
    type: "award",
    recipient: {_id: user._id, fullName: user.fullName},
    points,
    reason,
    refId
  }))
}

export async function redeemPoints(userId, points, reason, refId){
  const user = await UserServiceManager.getUserById(userId)
  await DB.transaction(async()=>{
    await UserServiceManager.addPoints(userId, points)
    await PointTransaction.create({
      type: "redeem",
      redeemedBy: {_id: user._id, fullName: user.fullName},
      points,
      reason,
      refId
    })
  })
}

export async function transferPoints(senderId, recipientId, points, reason){
  const [sender, recipient] = await Promise.all([
    UserServiceManager.getUserById(senderId),
    UserServiceManager.getUserById(recipientId)
  ])
  await DB.transaction(async()=>{
    await UserServiceManager.addPoints(senderId, points)
    await UserServiceManager.addPoints(recipientId, points)
    await PointTransaction.create({
      type: "transfer",
      sender: {_id: user._id, fullName: user.fullName},
      recipient: {_id: user._id, fullName: user.fullName},
      points,
      reason,
    })
  })
}

export async function deleteTransactionById(transactionId){
  let transaction = await getTransactionById(transactionId)
  await _deleteTransaction(transaction)
}

export async function deleteTransactionByRefId(refId,){
  let transaction = await getTransactionByRefId(refId)
  await _deleteTransaction(transaction)
}

export async function findByRefIdAndUpdatePoints(refId, newPoints){
    let transaction = await getTransactionByRefId(refId)
    let {redeemedBy, sender, recipient} = transaction
    let user = redeemedBy || sender || recipient
    await PointTransaction.updateOne({refId}, {$set: {points: newPoints}})
    await UserServiceManager.addPoints(user._id, newPoints - transaction.points)
  
}

async function _deleteTransaction(transaction){
  await DB.transaction(async()=>{
    await PointTransaction.deleteOne({_id: transaction._id})

    if(transaction.type === "redeem"){
      await UserServiceManager.addPoints(transaction.redeemedBy._id, transaction.points)
    }

    if(transaction.type === "award"){
      await UserServiceManager.addPoints(transaction.recipient._id, - transaction.points)
    }
    
    if(transaction.type === "transfer"){
      await UserServiceManager.addPoints(transaction.recipient._id, -transaction.points)
      await UserServiceManager.addPoints(transaction.sender._id, transaction.points)
    }

  })
}
