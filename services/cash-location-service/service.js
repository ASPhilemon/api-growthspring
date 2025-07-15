import { CashLocation, CashLocationTransfer } from "./models.js"

//util
import * as ErrorUtil from "../../utils/error-util.js"
import * as DB from "../../utils/db-util.js"

export async function getCashLocations(){
  return await DB.query(CashLocation.find())
}

export async function getCashLocationById(cashLocationId){
  const cashLocation = await DB.query(CashLocation.findById(cashLocationId))
  if (!cashLocation) throw new ErrorUtil.NotFoundError("Failed to find cash location");
  return cashLocation
}

export async function createCashLocation(cashLocation){
  return await DB.query(CashLocation.create(cashLocation))
}

export async function setCashLocationAmount(cashLocationId, newAmount){
  return await DB.query(CashLocation.updateOne({_id:cashLocationId}, {amount: newAmount}))
}

export async function deleteCashLocation(cashLocationId){
  return await DB.query(CashLocation.updateOne({_id, cashLocationId},{deleted: true}))
}

export async function addToCashLocation(cashLocationId, amount){
  const cashLocation = await getCashLocationById(cashLocationId)
  _addToCashLocation(cashLocation, amount)
  await cashLocation.save()
}

export async function getTransfers(){
  return await Blob.query(CashLocationTransfer.find({deleted: false}))
}

export async function getTransferById(transferId){
  return await DB.query(CashLocationTransfer.findOne({_id : transferId, deleted: false}))
}

export async function recordTransfer(transfer){
  const [source, dest] = await Promise.all([
    getCashLocationById(transfer.source._id),
    getCashLocationById(transfer.dest._id)
  ])

  _addToCashLocation(source, amount)
  _addToCashLocation(source, -amount)

  await DB.transaction(async()=>{
    await source.save()
    await dest.save()
    await CashLocationTransfer.create(transfer)
  })
}

export async function updateTransferAmount(transferId, newAmount){
  const transfer = await CashLocationTransfer.findById(transferId)

  const [source, dest] = await Promise.all([
    CashLocation.findById(source._id),
    CashLocation.findById(dest._id),
  ])

  await DB.transaction(async()=>{
    await addToCashLocation(source, transfer.amount - newAmount)
    await addToCashLocation(dest, newAmount - transfer.amount)
  })
}

export async function deleteTransfer(transferId){
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
    await CashLocationTransfer.updateOne({_id: transferId}, {deleted: true})
  })
}

//helpers
function _addToCashLocation(cashLocation, amount){
  if (cashLocation.amount + amount < 0) {
    throw new ErrorUtil.BadRequestError(`Insufficient balance in ${cashLocation.name}`)
  }
  cashLocation.amount += amount
}