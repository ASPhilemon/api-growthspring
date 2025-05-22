import { CashLocation, CashLocationTransfer } from "./models.js"

export async function getCashLocations(){
  return await CashLocation.find()
}

export async function getCashLocation(cashLocationId){
  return await CashLocation.findById(cashLocationId)
}

export async function createCashLocation(cashLocation){
  return await CashLocation.create(cashLocation)
}

export async function updateCashLocation(cashLocationId, update){
  return await CashLocation.updateOne({_id:cashLocationId}, update)
}

export async function deleteCashLocation(cashLocationId){
  return await CashLocation.findByIdAndDelete(cashLocationId)
}

export async function getCashLocationTransfers(){
  return await CashLocationTransfer.find()
}

export async function getCashLocationTransfer(cashLocationTransferId){
  return await CashLocationTransfer.findById(cashLocationTransferId)
}

export async function createCashLocationTransfer(cashLocationTransfer){
  const { sourceCashLocationId, destCashLocationId, amount} = cashLocationTransfer
  const [sourceCashLocation, destCashLocation] = await Promise.all([
    getCashLocation(sourceCashLocationId),
    getCashLocation(destCashLocationId)
  ])

  helperDeductFromCashLocation(sourceCashLocation, amount)
  helperAddToCashLocation(destCashLocation, amount)

  await Promise.all([
    sourceCashLocation.save(),
    destCashLocation.save(),
    CashLocationTransfer.create(cashLocationTransfer)
  ])
}

export async function deductFromCashLocation(cashLocationId, amount){
  const cashLocation = getCashLocation(cashLocationId)
  helperDeductFromCashLocation(cashLocation, amount)
  await cashLocation.save()
}

export async function addToCashLocation(cashLocationId, amount){
  const cashLocation = getCashLocation(cashLocationId)
  helperAddToCashLocation(cashLocation, amount)
  await cashLocation.save()
}

export async function updateCashLocationTransfer(transferId, update){
  const cashLocationTransfer = await CashLocationTransfer.findById(transferId)
  const { sourceCashLocationId, destCashLocationId, amount } = cashLocationTransfer

  const [sourceCashLocation, destCashLocation] = await Promise.all([
    CashLocation.findById(sourceCashLocationId),
    CashLocation.findById(destCashLocationId),
  ])

  // Set up new locations (possibly same as current)
  let sourceCashLocationNewPromise = sourceCashLocation ;
  let destCashLocationNewPromise = destCashLocation;

  if (sourceCashLocationId != update.sourceCashLocationId){
    sourceCashLocationNewPromise = CashLocation.findById(update.sourceCashLocationId)
  }

  if (destCashLocationId != update.destCashLocationId){
    destCashLocationNewPromise = CashLocation.findById(update.destCashLocationId)
  }

  const [sourceCashLocationNew, destCashLocationNew] = await Promise.all([
    sourceCashLocationNewPromise,
    destCashLocationNewPromise
  ])
 
//adjust source
  helperAddToCashLocation(sourceCashLocation, amount)

  try{
    helperDeductFromCashLocation(sourceCashLocationNew, update.amount)
  }
  catch(err){
    throw new Error(`Can not update the transfer because ${sourceCashLocationNew.name} would go negative `)
  }

  //adjust destination
  helperAddToCashLocation(destCashLocationNew, update.amount)

  try{
    helperDeductFromCashLocation(destCashLocation, amount)
  }
  catch(err){
    throw new Error(`Can not update the transfer because ${destCashLocation.name} would go negative `)
  }

}

export async function deleteCashLocationTransfer(transferId){
  const cashLocationTransfer = await CashLocationTransfer.findById(transferId)
  const { sourceCashLocationId, destCashLocationId, amount } = cashLocationTransfer

  const [sourceCashLocation, destCashLocation] = await Promise.all([
    CashLocation.findById(sourceCashLocationId),
    CashLocation.findById(destCashLocationId),
  ])

  try {
    helperDeductFromCashLocation(destCashLocation, amount)
  }
  catch(err){
    throw new Error(`Can not delete this transfer because ${destCashLocation.name} will go to negative balance`)
  }

  helperAddToCashLocation(sourceCashLocation, amount)

  await Promise.all([
    sourceCashLocation.save(),
    destCashLocation.save(),
    cashLocationTransfer.deleteOne()
  ])
}

function helperDeductFromCashLocation(cashLocation, amount){
  if (amount < 0) throw new Error("Amount can not be less than 0.")
  if (cashLocation.amount < amount) throw new Error(`Insufficient balance in ${cashLocation.name}`)
  cashLocation.amount -= amount
}

function helperAddToCashLocation(cashLocation, amount){
  if (amount < 0) throw new Error("Amount can not be less than 0.")
  cashLocation.amount -= amount
}