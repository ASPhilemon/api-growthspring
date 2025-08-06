import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getDeposits(req, res){
  let {userId, year, month, sortBy, sortOrder, page, perPage} = req.query
  let filter = {
    userId,
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
  let deposits = await ServiceManager.getDeposits(filter, sort, pagination)
  Response.sendSuccess(deposits, {req, res})
}

export async function getDepositById(req, res){
  const { id: depositId } = req.params
  const deposit = await ServiceManager.getDepositById(depositId)
  Response.sendSuccess(deposit, {req, res})
}

export async function getYearlyDeposits(req, res){
  const yearlyDeposits = await ServiceManager.getYearlyDeposits()
  Response.sendSuccess(yearlyDeposits, {req, res})
}

export async function recordDeposit(req, res){
  const deposit = req.body
  const {_id, fullName} = req.user
  deposit.recordedBy = {_id, fullName}
  await ServiceManager.recordDeposit({...deposit})
  Response.sendSuccess(null, {req, res})
}

export async function updateDeposit(req, res){
  const { id: depositId } = req.params
  const update = req.body
  update.updatedById = req.user._id
  await ServiceManager.updateDeposit(depositId, update)
  Response.sendSuccess(null, {req, res})
}

export async function deleteDeposit(req, res){
  const { id: depositId } = req.params
  const {cashLocationToDeductId} = req.body
  await ServiceManager.deleteDeposit(depositId, cashLocationToDeductId)
  Response.sendSuccess(null, {req, res})
}