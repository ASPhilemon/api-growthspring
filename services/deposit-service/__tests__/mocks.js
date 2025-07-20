import {v4 as uuid} from "uuid"
import { faker } from "@faker-js/faker"
import * as UserMocks from "../../user-service/__tests__/mocks.js"
import * as CashLocationMocks from "../../cash-location-service/__tests__/mocks.js"

const MIN_DATE = "2023-01-01"
const MAX_DATE = "2024-12-31"

export function generateInputDeposit(depositor, depositType, cashLocation){
  if (!depositor) depositor = UserMocks.generateDBUser();
  if(!depositType) depositType = "Permanent";
  if (!cashLocation) cashLocation = CashLocationMocks.generateInputCashLocation();

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

export function generateDBDeposit(depositor, depositType, recordedBy, cashLocation){
  if (!depositor) depositor = UserMocks.generateDBUser();
  if(!depositType) depositType = faker.helpers.arrayElement(["Permanent", "Temporary"]);
  if(!recordedBy) recordedBy = UserMocks.generateDBUser("admin");
  if(!cashLocation) cashLocation = CashLocationMocks.generateInputCashLocation();

  let dbDeposit = {
    _id: uuid(),
    depositor: {_id: depositor._id, fullName: depositor.fullName},
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}),
    amount: faker.number.int({min: 1, max: 1_000_000}),
    type: depositType,
    balanceBefore: faker.number.int({min: 1, max: 1_000_000}),
    pointsBefore: faker.number.int({min: 1, max: 1_000}),
    recordedBy: {_id: recordedBy._id, fullName: recordedBy.fullName},  
    source: faker.helpers.arrayElement(["Savings", "Profits", "Excess Loan Payment", "Interest"]),
    cashLocation,
  }
  return dbDeposit
}

export function generateDBDeposits(numberOfDeposits, depositors){
  if(!depositors){
    let numberOfDepositors = 5
    depositors = UserMocks.generateDBUsers(numberOfDepositors)
  }

  const dbDeposits = []
  //ensure dbDeposits have unique dates and amounts for deterministic sort by date and amount in mongodb
  let recordedDepositDates = new Set()
  let recordedDepositAmounts = new Set()

  for (let i = 0; i < numberOfDeposits;){
    let depositor = faker.helpers.arrayElement(depositors);
    let dbDeposit = generateDBDeposit(depositor)
    let isUnique = !recordedDepositDates.has(dbDeposit.date.toISOString()) &&
    !recordedDepositAmounts.has(dbDeposit.amount)
    if (isUnique){
      dbDeposits.push(dbDeposit)
      recordedDepositDates.add(dbDeposit.date.toISOString())
      recordedDepositAmounts.add(dbDeposit.amount)
      i++
    }
  }

  return dbDeposits
}

export function generateDepositUpdate(cashLocationToAdd, cashLocationToDeduct){
  if (!cashLocationToAdd) cashLocationToAdd = CashLocationMocks.generateInputCashLocation();
  if (!cashLocationToDeduct) cashLocationToDeduct = CashLocationMocks.generateInputCashLocation()

  let depositUpdate = {
    amount: faker.number.int({min: 1, max: 1_000_000}),
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}).toISOString(),
    cashLocationToAdd,
    cashLocationToDeduct,
  }

  return depositUpdate
}

export function generateDBYearlyDeposit(){
  let dbYearlyDeposit = {
    year: faker.number.int({min: 2020, max: 2025}),
    total: faker.number.int({min: 1, max: 10_000_000}),
    monthTotals: Array.from({ length: 12 }, () => faker.number.int({ min: 0, max: 1000 })),
  }

  return dbYearlyDeposit
}