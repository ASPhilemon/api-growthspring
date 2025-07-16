import {v4 as uuid} from "uuid"
import { faker } from "@faker-js/faker"
import * as UserMocks from "../../user-service/__tests__/mocks.js"
import * as CashLocationMocks from "../../cash-location-service/__tests__/mocks.js"

const MIN_DATE = "2022-01-01"
const MAX_DATE = "2025-01-01"

export function createInputDeposit(depositor, depositType, cashLocation){
  if (!depositor) depositor = UserMocks.createDBUser();
  if(!depositType) depositType = "Permanent";
  if (!cashLocation) cashLocation = CashLocationMocks.createInputCashLocation();

  let inputDeposit = {
    _id: uuid(),
    depositor: {_id: depositor._id, fullName: depositor.fullName},
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}).toISOString(),
    amount: faker.number.int({min: 1, max: 1_000_000}),
    type: depositType,
    source: faker.helpers.arrayElement(["Savings", "Profits", "Excess Loan Payment", "Interest"]),
    cashLocation,
  }

  return inputDeposit
}

export function createDBDeposit(depositor, depositType, recordedBy, cashLocation){
  if (!depositor) depositor = UserMocks.createDBUser();
  if(!depositType) depositType = "Permanent";
  if(!recordedBy) recordedBy = UserMocks.createDBUser("admin");
  if(!cashLocation) cashLocation = CashLocationMocks.createInputCashLocation();

  let dbDeposit = {
    _id: uuid(),
    depositor: {_id: depositor._id, fullName: depositor.fullName},
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}),
    amount: faker.number.int({min: 1, max: 1_000_000}),
    type: depositType,
    balanceBefore: faker.number.int({min: 1, max: 1_000_000}),
    pointsBefore: faker.number.int({min: 1, max: 1_000}),
    recordedBy,  
    source: faker.helpers.arrayElement(["Savings", "Profits", "Excess Loan Payment", "Interest"]),
    cashLocation,
  }
  return dbDeposit
}

export function createDepositUpdate(cashLocationToAdd, cashLocationToDeduct){
  if (!cashLocationToAdd) cashLocationToAdd = CashLocationMocks.createInputCashLocation();
  if (!cashLocationToDeduct) cashLocationToDeduct = CashLocationMocks.createInputCashLocation()

  let depositUpdate = {
    amount: faker.number.int({min: 1, max: 1_000_000}),
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}).toISOString(),
    cashLocationToAdd,
    cashLocationToDeduct,
  }

  return depositUpdate
}

export function createDBYearlyDeposit(){
  let dbYearlyDeposit = {
    year: faker.number.int({min: 2020, max: 2025}),
    total: faker.number.int({min: 1, max: 10_000_000}),
    monthTotals: Array.from({ length: 12 }, () => faker.number.int({ min: 0, max: 1000 })),
  }

  return dbYearlyDeposit
}