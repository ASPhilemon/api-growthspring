import mongoose from "mongoose"
import { faker } from "@faker-js/faker"

const { ObjectId } = mongoose.Types

export function createDBCashLocation(
  cashLocationId = new ObjectId().toString(),
  cashLocationName = "Mobile Money"
){
  const cashLocation = {
    _id: cashLocationId,
    name: cashLocationName,
    amount: faker.number.int({min: 0, max: 10_000_000})
  };
  return cashLocation
}

export function createInputCashLocation(
  cashLocationId = new ObjectId().toString(),
  cashLocationName = "Mobile Money"
){
  const cashLocation = {_id: cashLocationId, name: cashLocationName};
  return cashLocation
}