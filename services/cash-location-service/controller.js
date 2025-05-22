import * as ServiceManager from "./service.js"

export async function getCashLocations(req, res){
  try{
    const cashLocations = await ServiceManager.getCashLocations()
    const response = {error:null, data:cashLocations}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    const response = {error: err, data:null}
    return res.status(400).json(response)
  }
}

export async function getCashLocation(req, res){
  const cashLocationId  = req.params.id
  try{
    const cashLocation = await ServiceManager.getCashLocation(cashLocationId)
    return res.json({error:null, data:cashLocation})
  }
  catch(err){
    console.log(err)
    const response = {error: err, data:null}
    return res.status(400).json(response)
  }
}

export async function createCashLocation(req, res){
  const { cashLocation } = req.body
  try{
    await ServiceManager.createCashLocation(cashLocation)
    const response = {error: null, data:null}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}

export async function updateCashLocation(req, res){
  const cashLocationId = req.params.id
  const { update } = req.body
  try{
    await ServiceManager.updateCashLocation(cashLocationId, update)
    const response = {error: null, data: null}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}

export async function deleteCashLocation(req, res){
  const cashLocationId  = req.params.id
  try{
    await ServiceManager.deleteCashLocation(cashLocationId)
    const response = {error: null, data: null}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}

export async function getCashLocationTransfers(req, res){
  try{
    const cashLocationTransfers = await ServiceManager.getCashLocationTransfers(req.body)
    const response = {error: null, data: cashLocationTransfers}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}

export async function  getCashLocationTransfer(req, res){
  const cashLocationTransferId  = req.params.id
  try{
    const cashLocationTransfer = await ServiceManager.getCashLocationTransfer(cashLocationTransferId)
    const response = {error: null, data: cashLocationTransfer}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}

export async function createCashLocationTransfer(req, res){
  const cashLocationTransfer = req.body
  try{
    await ServiceManager.createCashLocationTransfer(cashLocationTransfer)
    const response = {error: null, data: null}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}

export async function updateCashLocationTransfer(req, res){
  const cashLocationTransferId  = req.params.id
  const {update} = req.body
  try{
    await ServiceManager.updateCashLocationTransfer(cashLocationTransferId, update)
    const response = {error: null, data: null}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}
  
export async function deleteCashLocationTransfer(req, res){
  const cashLocationTransferId  = req.params.id
  try{
    await ServiceManager.deleteCashLocationTransfer(cashLocationTransferId)
    const response = {error: null, data: null}
    return res.json(response)
  }
  catch(err){
    console.log(err)
    return res.status(400).json({error: err})
  }
}