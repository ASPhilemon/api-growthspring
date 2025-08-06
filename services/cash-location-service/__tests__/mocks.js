import mongoose from "mongoose"
import { faker } from "@faker-js/faker"

const { ObjectId } = mongoose.Types

export function generateDBCashLocation({_id, name, amount} = {}){
  if(!_id) _id = new ObjectId().toString();
  if (!name) name = faker.helpers.arrayElement(["Mobile Money", "Standard Chartered"]);
  if(!amount) amount = faker.number.int({min: 0, max: 10_000_000})

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