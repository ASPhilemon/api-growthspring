import {v4 as uuid} from "uuid"
import { faker } from "@faker-js/faker"
import * as UserMocks from "../../user-service/__tests__/mocks.js"
import * as CashLocationMocks from "../../cash-location-service/__tests__/mocks.js"

const MIN_DATE = "2023-01-01"
const MAX_DATE = "2024-12-31"

export function generateInputWithdraw({withdrawnBy, cashLocation} = {}){
  if (!withdrawnBy) withdrawnBy = UserMocks.generateDBUser();
  if (!cashLocation) cashLocation = CashLocationMocks.generateInputCashLocation();

  let inputWithdraw = {
    _id: uuid(),
    withdrawnBy: {_id: withdrawnBy._id, fullName: withdrawnBy.fullName},
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}).toISOString(),
    amount: faker.number.int({min: 1, max: 1_000_000}),
    cashLocation: {_id: cashLocation._id, name: cashLocation.name},
  }

  return inputWithdraw
}

export function generateDBWithdraw({withdrawnBy, recordedBy, cashLocation} = {}){
  if (!withdrawnBy) withdrawnBy = UserMocks.generateDBUser();
  if(!recordedBy) recordedBy = UserMocks.generateDBUser("admin");
  if(!cashLocation) cashLocation = CashLocationMocks.generateInputCashLocation();

  let dbWithdraw = {
    _id: uuid(),
    withdrawnBy: {
      _id: withdrawnBy._id,
      fullName: withdrawnBy.fullName
    },
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}),
    amount: faker.number.int({min: 1, max: 1_000_000}),
    recordedBy: {
      _id: recordedBy._id,
      fullName: recordedBy.fullName
    },  
    cashLocation: {
      _id: cashLocation._id,
      name: cashLocation.name
    },
  }
  return dbWithdraw
}

export function generateDBWithdraws({numberOfWithdraws, withdrawers} = {}){
  if(!withdrawers){
    let numberOfWithdrawers = 5
    withdrawers = UserMocks.generateDBUsers({numberOfWithdrawers})
  }

  const dbWithdraws = []
  //ensure dbWithdraws have unique dates and amounts for deterministic sort by date and amount in mongodb
  let recordedWithdrawDates = new Set()
  let recordedWithdrawAmounts = new Set()

  for (let i = 0; i < numberOfWithdraws;){
    let withdrawnBy = faker.helpers.arrayElement(withdrawers);
    let dbWithdraw = generateDBWithdraw({withdrawnBy})
    let isUnique = !recordedWithdrawDates.has(dbWithdraw.date.toISOString()) &&
    !recordedWithdrawAmounts.has(dbWithdraw.amount)
    if (isUnique){
      dbWithdraws.push(dbWithdraw)
      recordedWithdrawDates.add(dbWithdraw.date.toISOString())
      recordedWithdrawAmounts.add(dbWithdraw.amount)
      i++
    }
  }

  return dbWithdraws
}

export function generateWithdrawUpdate({cashLocationToAdd, cashLocationToDeduct} = {}){
  if (!cashLocationToAdd) cashLocationToAdd = CashLocationMocks.generateInputCashLocation();
  if (!cashLocationToDeduct) cashLocationToDeduct = CashLocationMocks.generateInputCashLocation()

  let withdrawUpdate = {
    amount: faker.number.int({min: 1, max: 1_000_000}),
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}).toISOString(),
    cashLocationToAdd: {
      _id: cashLocationToAdd._id,
      name: cashLocationToAdd.name
    },
    cashLocationToDeduct: {
      _id: cashLocationToDeduct._id,
      name: cashLocationToDeduct.name
    },
  }

  return withdrawUpdate
}