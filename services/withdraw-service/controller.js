import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getWithdraws(req, res){
  const withdraws = await ServiceManager.getWithdraws()
  Response.sendSuccess(withdraws, {req, res})
}

export async function getWithdrawById(req, res){
  const {id: withdrawId} = req.params
  const withdraw = ServiceManager.getWithdrawById(withdrawId)
  Response.sendSuccess(withdraw, {req, res})
}

export async function recordWithdraw(req, res){
  const { withdraw, cashLocations } = req.body
  await ServiceManager.recordWithdraw(withdraw, cashLocations)
  Response.sendSuccess(null, {req, res})
}

export async function updateWithdrawAmount(req, res){
  const {newAmount, newCashLocations} = req.body
  const {id: withdrawId} = req.params
  await ServiceManager.updateWithdrawAmount(withdrawId, newAmount, newCashLocations)
  Response.sendSuccess(null, {req, res})
}

export async function deleteWithdraw(req, res){
  const {id: withdrawId} = req.params
  await ServiceManager.deleteWithdraw(withdrawId)
  Response.sendSuccess(null, {req, res})
}