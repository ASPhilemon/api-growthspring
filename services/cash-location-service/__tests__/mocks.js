import mongoose from "mongoose"
import { faker } from "@faker-js/faker"
import { v4 as uuid } from "uuid";

const { ObjectId } = mongoose.Types

export function generateDBCashLocation({_id, name, amount} = {}){
  if(!_id) _id = new ObjectId().toString();
  if (!name) name = faker.helpers.arrayElement(["Mobile Money", "Standard Chartered"]);
  if(!amount) amount = faker.number.int({min: 10_000_000, max: 20_000_000})

  const cashLocation = {
    _id,
    name,
    amount
  };
  return cashLocation
}

export function generateInputCashLocation({_id, name} = {}){
  const cashLocation = generateDBCashLocation({_id, name})
  delete cashLocation.amount
  return cashLocation
}

export function generateDBCashLocations(){
  const numberOfCashLocations = 10
  const cashLocations = []

  for (let i = 0; i < numberOfCashLocations; i++){
    cashLocations.push(generateDBCashLocation())
  }

  return cashLocations
}

export function generateCashLocationUpdate(){
  return {
    amount: faker.number.int({min: 1, max: 10_000_000})
  }
}

export function generateTransfer(source, dest){
 if (!source) source =  generateInputCashLocation();
 if (!dest) dest =  generateInputCashLocation();


  return {
    _id: uuid(),
    source: {_id: source._id, name: source.name},
    dest: {_id: dest._id, name: dest.name},
    amount: faker.number.int({min: 1, max: 20_000})
  }
}

export function generateTransferUpdate(transfer){
  if(!transfer) transfer = generateTransfer()
  return {
    amount: faker.number.int({min: 1, max: 20_000})
  }
}

export function generateTransfers(){
  const numberOfTransfers = 100
  const transfers = []

  for (let i = 0; i < numberOfTransfers; i++){
    transfers.push(generateTransfer())
  }

  return transfers
}