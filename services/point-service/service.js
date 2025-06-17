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

export async function rewardUser(userId, points, reason, refId){
  const user = await UserServiceManager.getUserById(userId)
  await DB.transaction(async()=>{
    await UserServiceManager.addPoints(userId, points)
    await PointTransaction.create({
      type: "reward",
      recipient: {_id: user._id, fullName: user.fullName},
      points,
      reason,
      refId
    })
  })
}

export async function redeemPoints(userId, points, reason, refId){
  const user = await UserServiceManager.getUserById(userId)
  await DB.transaction(async()=>{
    await UserServiceManager.deductPoints(userId, points)
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
    await UserServiceManager.deductPoints(senderId, points)
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
  const result = await DB.query(PointTransaction.findOneAndDelete({_id: transactionId}))
  Validator.assert(result.matchedCount !== 0, "Failed to find point transaction to delete")
}

export async function deleteTransactionByRefId(refId){
  const result = await DB.query(PointTransaction.findOneAndDelete({refId}))
  Validator.assert(result.matchedCount !== 0, "Failed to find point transaction to delete")
}