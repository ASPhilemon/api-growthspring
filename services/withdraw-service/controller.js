import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getWithdraws(req, res){
  const withdraws = await ServiceManager.getWithdraws()
  Response.sendSuccess(res, withdraws)
}

export async function getWithdrawById(req, res){
  const {id: withdrawId} = req.params
  const withdraw = ServiceManager.getWithdrawById(withdrawId)
  Response.sendSuccess(res, withdraw)
}

export async function recordWithdraw(req, res){
  const { withdraw, cashLocations } = req.body
  ServiceManager.recordWithdraw(withdraw, cashLocations)
  Response.sendSuccess(res, null)
}

export async function updateWithdrawAmount(req, res){
  const {newAmount, newCashLocations} = req.body
  const {id: withdrawId} = req.params
  await ServiceManager.updateWithdrawAmount(withdrawId, newAmount, newCashLocations)
  Response.sendSuccess(res, null)
}

export async function deleteWithdraw(req, res){
  const {id: withdrawId} = req.params
  await ServiceManager.deleteWithdraw(withdrawId)
  Response.sendSuccess(res, null)
}