import { CashLocation, CashLocationTransfer } from "./models.js"

//util
import * as Errors from "../../utils/error-util.js"
import * as DB from "../../utils/db-util.js"
import * as Validator from "../../utils/validator-util.js"

import * as Schemas from "./schemas.js"

export async function getCashLocations(){
  return await DB.query(CashLocation.find())
}

export async function getCashLocationById(cashLocationId){
  Validator.schema(Schemas.getCashLocationById, cashLocationId)
  const cashLocation = await DB.query(CashLocation.findById(cashLocationId))
  if (!cashLocation) throw new Errors.NotFoundError("Failed to find cash location");
  return cashLocation
}

export async function updateCashLocation(cashLocationId, update){
  Validator.schema(Schemas.updateCashLocation, {cashLocationId, update})
  return await DB.query(CashLocation.updateOne({_id:cashLocationId}, {amount: update.amount}))
}

export async function addToCashLocation(cashLocationId, amount){
  Validator.schema(Schemas.addToCashLocation, {cashLocationId, amount})
  await DB.transaction(async()=>{
    const cashLocation = await getCashLocationById(cashLocationId)
    _addToCashLocation(cashLocation, amount)
    await cashLocation.save()
  })
}

export async function getTransfers(){
  return await DB.query(CashLocationTransfer.find())
}

export async function getTransferById(transferId){
  Validator.schema(Schemas.getTransferById, transferId)
  return await DB.query(CashLocationTransfer.findOne({_id : transferId}))
}

export async function recordTransfer(transfer){
  Validator.schema(Schemas.recordTransfer, transfer)
  await DB.transaction(async()=>{
    const [source, dest] = await Promise.all([
      getCashLocationById(transfer.source._id),
      getCashLocationById(transfer.dest._id)
    ])

    _addToCashLocation(source, -transfer.amount)
    _addToCashLocation(dest, transfer.amount)

    await source.save()
    await dest.save()
    await CashLocationTransfer.create(transfer)
  })
}

export async function updateTransfer(transferId, update){
  Validator.schema(Schemas.updateTransfer, {transferId, update})
  await DB.transaction(async()=>{
    const transfer = await CashLocationTransfer.findById(transferId)
    const [source, dest] = await Promise.all([
      CashLocation.findById(transfer.source._id),
      CashLocation.findById(transfer.dest._id),
    ])

    const sourceId = source._id.toHexString()
    const destId = dest._id.toHexString()

    await addToCashLocation(sourceId, transfer.amount - update.amount)
    await addToCashLocation(destId, update.amount - transfer.amount)

    transfer.amount = update.amount
    await transfer.save()
  })
}

export async function deleteTransfer(transferId){
  Validator.schema(Schemas.deleteTransfer, transferId)
  const transfer = await CashLocationTransfer.findById(transferId)

  const [source, dest] = await Promise.all([
    CashLocation.findById(transfer.source._id),
    CashLocation.findById(transfer.dest._id),
  ])

  _addToCashLocation(source, transfer.amount)
  _addToCashLocation(dest, -transfer.amount)

  await DB.transaction(async()=> {
    await source.save()
    await dest.save()
    await CashLocationTransfer.deleteOne({_id: transferId})
  })
}

//helpers
function _addToCashLocation(cashLocation, amount){
  if (cashLocation.amount + amount < 0) {
    throw new Errors.BadRequestError(`Insufficient balance in ${cashLocation.name}`)
  }
  cashLocation.amount += amount
}