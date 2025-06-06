import { PointTransaction } from "./models.js"
import * as DB from "../../utils/db-util.js"
import * as ErrorUtil from "../../utils/error-util.js"

//collaborator services
import * as UserServiceManager from "../user-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"

export async function getTransactions(filter){
  return PointTransaction.getTransactions({filter})
}

export async function getTransactionById(transactionId){
  const transaction =  DB.query(PointTransaction.findById(transactionId))
  if (!transaction) throw new ErrorUtil.NotFoundError("Transaction not found");
  return transaction
}

export async function recordTransaction(transaction){
  const {type, recipientId, senderId, reason, redeemedById, points:amountPoints} = transaction
  if (recipientId) await UserServiceManager.updateUser(recipientId, {$inc:{points: amountPoints }});
  if (senderId) await UserServiceManager.updateUser(senderId, {$inc:{points: -amountPoints }});
  if (redeemedById) await UserServiceManager.updateUser(redeemedById, {$inc:{points: -amountPoints }});
  await DB.query(PointTransaction.create(transaction))
}

export async function setPoints(filter, newPoints){
  const result = await DB.query(PointTransaction.updateOne({filter}, {$set: {points: newPoints}}))
  if (result.matchedCount == 0){
    throw new ErrorUtil.BadRequestError("Failed to find point transaction")
  }
}

export async function deleteTransaction(filter){
  const result = await DB.query(PointTransaction.findOneAndDelete(filter))
  if (result.matchedCount == 0){
    throw new ErrorUtil.BadRequestError("Failed to find transaction to delete")
  }
}