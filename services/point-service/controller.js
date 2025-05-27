import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getTransactions(req, res){
  const filter = { recipientId, senderId, redeemedById } = req.query
  const transactions = await ServiceManager.getTransactions(filter)
  Response.sendSuccess(res, transactions)
}

export async function getTransactionById(req, res){
  const transactionId = req.params.id
  const transaction = await ServiceManager.getTransactionById(transactionId)
  Response.sendSuccess(res, transaction)
}

export async function recordTransaction(req, res){
  const { transaction } = req.body
  await ServiceManager.recordTransaction(transaction)
  Response.sendSuccess(res, null)
}

export async function setPoints(req, res){
  const { newPoints } = req.body
  const { transactionId } = req.params
  await ServiceManager.setPoints({_id: transactionId, newPoints})
  Response.sendSuccess(res, null)
}

export async function deleteTransaction(req, res){
  const { transactionId } = req.params
  await ServiceManager.deleteTransaction({_id: transactionId})
  Response.sendSuccess(res, null)
}