import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getDeposits(req, res){
  const {filter, sort, pagination} = req.query
  const deposits = await ServiceManager.getDeposits({ filter, sort, pagination})
  Response.sendSuccess(res, deposits)
}

export async function getDeposit(req, res){
  const { id: depositId }= req.params
  const deposit = await ServiceManager.getDeposit(depositId)
  Response.sendSuccess(res, deposit)
}

export async function createDeposit(req, res){
  const { deposit } = req.body
  await ServiceManager.createDeposit(deposit)
  Response.sendSuccess(res, null)
}

export async function updateDeposit(req, res){
  const { id: depositId } = req.params
  const { update } = req.body
  await ServiceManager.updateDeposit(depositId, update)
  Response.sendSuccess(res, null)
}

export async function deleteDeposit(req, res){
  const { id: depositId }= req.params
  await ServiceManager.deleteDeposit(depositId)
  Response.sendSuccess(res, null)
}