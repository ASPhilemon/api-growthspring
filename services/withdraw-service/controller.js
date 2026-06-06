import * as Service from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getWithdraws(req, res){
  const {userId, year, month, sortBy, sortOrder, page, perPage} = req.query
  const filter = {
    userId,
    year: Number(year) || undefined,
    month: Number(month) || undefined
  }
  const sort = {
    field: sortBy,
    order: Number(sortOrder) || undefined
  }
  const pagination = {
    page: Number(page) || undefined,
    perPage: Number(perPage) || undefined
  }

  const withdraws = await Service.getWithdraws(filter, sort, pagination)
  Response.sendSuccess(withdraws, {req, res})
}

export async function getWithdrawById(req, res){
  const {id: withdrawId} = req.params
  const withdraw = await Service.getWithdrawById(withdrawId)
  Response.sendSuccess(withdraw, {req, res})
}

export async function recordWithdraw(req, res){
  const withdraw = req.body
  const {_id, fullName} = req.user
  withdraw.recordedBy = {_id, fullName}
  await Service.recordWithdraw(withdraw)
  Response.sendSuccess(null, {req, res})
}

export async function updateWithdraw(req, res){
  const {id: withdrawId} = req.params
  const update = req.body
  await Service.updateWithdraw(withdrawId, update)
  Response.sendSuccess(null, {req, res})
}

export async function deleteWithdraw(req, res){
  const {id: withdrawId} = req.params
  const { cashLocationToAddId } = req.body
  await Service.deleteWithdraw(withdrawId, cashLocationToAddId)
  Response.sendSuccess(null, {req, res})
}