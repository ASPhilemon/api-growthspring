import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getDeposits(req, res){
  const {filter, sort, pagination} = req.query
  const deposits = await ServiceManager.getDeposits({ filter, sort, pagination})
  Response.sendSuccess(deposits, {req, res})
}

export async function getClubDeposits(req, res){
  const clubDeposits = await ServiceManager.getClubDeposits()
  Response.sendSuccess(clubDeposits, {req, res})
}

export async function getDeposit(req, res){
  const { id: depositId }= req.params
  const deposit = await ServiceManager.getDeposit(depositId)
  Response.sendSuccess(deposit, {req, res})
}

export async function recordDeposit(req, res){
  const { deposit } = req.body
  await ServiceManager.createDeposit(deposit)
  Response.sendSuccess(null, {req, res})
}

export async function setDepositAmount(req, res){
  const { id: depositId } = req.params
  const { amount } = req.body
  await ServiceManager.setDepositAmount(depositId, amount)
  Response.sendSuccess(null, {req, res})
}

export async function deleteDeposit(req, res){
  const { id: depositId }= req.params
  await ServiceManager.deleteDeposit(depositId)
  Response.sendSuccess(null, {req, res})
}