import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"
import * as DateUtil from "../../utils/date-util.js"

export async function getTransactions(req, res){
  let {userId, type, year, month, sortBy, sortOrder, page, perPage} = req.query
  let filter = {
    userId,
    type,
    year: Number(year) || undefined,
    month: Number(month) || undefined
  }
  let sort = {
    field: sortBy,
    order: Number(sortOrder) || undefined
  }
  let pagination = {
    page: Number(page) || undefined,
    perPage: Number(perPage) || undefined
  }
  const transactions = await ServiceManager.getTransactions(filter, sort, pagination)
  Response.sendSuccess(transactions, {req, res})
}

export async function getTransactionById(req, res){
  const transactionId = req.params.id
  const transaction = await ServiceManager.getTransactionById(transactionId)
  Response.sendSuccess(transaction, {req, res})
}

export async function recordTransaction(req, res){
  const transaction = req.body
  await ServiceManager.recordTransaction(transaction)
  Response.sendSuccess(null, {req, res})
}

export async function updateTransaction(req, res){
  const { newPoints } = req.body
  const transactionId = req.params.id
  await ServiceManager.findByIdAndUpdatePoints(transactionId, newPoints)
  Response.sendSuccess(null, {req, res})
}

export async function deleteTransaction(req, res){
  const {id: transactionId} = req.params
  await ServiceManager.deleteTransactionById(transactionId)
  Response.sendSuccess(null, {req, res})
}