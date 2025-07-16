import mongoose from "mongoose"
import { faker } from "@faker-js/faker"

const { ObjectId } = mongoose.Types

const MIN_DATE = "2022-01-01"
const MAX_DATE = "2025-01-01"

export function createDBUser(userType = "regular"){
  let dbUser = {
    _id: new ObjectId().toString(),
    fullName: faker.person.fullName(),
    membershipDate: faker.date.between({from: MIN_DATE, to: MAX_DATE}),
    points: faker.number.int({min: 0, max: 1_000}),
    temporaryInvestment: {
      amount: faker.number.int({min: 0, max: 10_000_000}),
      units: faker.number.int({min: 0, max: 10_000}),
      unitsDate: faker.date.between({from: MIN_DATE, to: MAX_DATE})
    },
    permanentInvestment:  {
      amount: faker.number.int({min: 0, max: 10_000_000}),
      units: faker.number.int({min: 0, max: 10_000}),
      unitsDate: faker.date.between({from: MIN_DATE, to: MAX_DATE})
    },
    email: faker.internet.email(),
    phoneContact: faker.phone.number({style: "international"}),
    isAdmin: userType == "admin"? true: false
  }
  return dbUser
}