import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getCashLocations(req, res){
  const cashLocations = await ServiceManager.getCashLocations()
  Response.sendSuccess(cashLocations, {req, res})
}

export async function getCashLocationById(req, res){
  const { id: cashLocationId } = req.params
  const cashLocation = await ServiceManager.getCashLocationById(cashLocationId)
  Response.sendSuccess(cashLocation, {req, res})
}

export async function updateCashLocation(req, res){
  const { id : cashLocationId } = req.params
  const update = req.body
  await ServiceManager.updateCashLocation(cashLocationId, update)
  Response.sendSuccess(null, {req, res})
}

export async function getTransfers(req, res){
  const transfers = await ServiceManager.getTransfers()
  Response.sendSuccess(transfers, {req, res})
}

export async function  getTransferById(req, res){
  const {id: transferId }  = req.params
  const transfer = await ServiceManager.getTransferById(transferId)
  Response.sendSuccess(transfer, {req, res})
}

export async function recordTransfer(req, res){
  const transfer  = req.body
  await ServiceManager.recordTransfer(transfer)
  Response.sendSuccess(null, {req, res})
  
}

export async function updateTransfer(req, res){
  const { id: transferId }  = req.params
  const update = req.body
  await ServiceManager.updateTransfer(transferId, update)
  Response.sendSuccess(null, {req, res})
}
  
export async function deleteTransfer(req, res){
  const {id: transferId}  = req.params
  await ServiceManager.deleteTransfer(transferId)
  Response.sendSuccess(null, {req, res})
}