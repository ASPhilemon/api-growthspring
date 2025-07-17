import mongoose from "mongoose"
import { faker } from "@faker-js/faker"

const { ObjectId } = mongoose.Types

const MIN_DATE = "2022-01-01"
const MAX_DATE = "2025-01-01"

export function generateDBUser(userType = "regular"){
  let firstName = faker.person.firstName()
  let lastName = faker.person.lastName()
  let dbUser = {
    _id: new ObjectId().toString(),
    fullName: firstName + " " + lastName,
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
    email: faker.internet.email({firstName, lastName}),
    phoneContact: faker.phone.number({style: "international"}),
    isAdmin: userType == "admin"? true: false
  }
  return dbUser
}

export function generateDBUsers(numberOfUsers){
  const dbUsers = []
  for (let i = 0; i < numberOfUsers; i++){
    dbUsers.push(generateDBUser())
  }

  return dbUsers
}