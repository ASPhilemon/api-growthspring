import mongoose from "mongoose"
import { faker } from "@faker-js/faker"

const { ObjectId } = mongoose.Types

export function generateDBCashLocation(_id, name){
  if(!_id) _id = new ObjectId().toString();
  if (!name) name = faker.helpers.arrayElement(["Mobile Money", "Standard Chartered"])

  const cashLocation = {
    _id,
    name,
    amount: faker.number.int({min: 0, max: 10_000_000})
  };
  return cashLocation
}

export function generateInputCashLocation(_id, name){
  const cashLocation = generateDBCashLocation(_id, name)
  delete cashLocation.amount
  return cashLocation
}