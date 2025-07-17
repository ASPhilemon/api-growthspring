import { jest } from '@jest/globals';
import mongoose from "mongoose";
import connectDB from "../../../db.js"

import {Deposit, YearlyDeposit} from "../models.js"
import * as Mocks from "./mocks.js";
import * as UserMocks from "../../user-service/__tests__/mocks.js";
import { User } from "../../user-service/models.js"

beforeAll(async()=>{ 
  process.env.MONGODB_URI = process.env.MONGO_URL
  await connectDB()
})

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
});

//Deposit Model
describe("Deposit Model:Write Operations", ()=>{
  let depositor, deposit

  beforeAll(async()=>{
    await mongoose.connection.dropDatabase()
    depositor = UserMocks.generateDBUser()
    deposit = Mocks.generateDBDeposit(depositor, "Permanent")
    await Deposit.create(deposit)
  })

  test("Deposit.create should insert a new deposit in collection", async ()=>{
    const insertedDeposit = await Deposit.findById(deposit._id)
    expect(insertedDeposit).not.toBe(null)
  })

  test("Deposit.updateOne should update existing deposit", async ()=>{
    await Deposit.updateOne({_id: deposit._id}, {$set: {amount: 1_000}})
    let updatedDeposit = await Deposit.findById(deposit._id)
    expect(updatedDeposit.amount).toEqual(1_000)
  })

  test("Deposit.deleteOne should delete deposit", async ()=>{
    await Deposit.deleteOne({_id: deposit._id})
    const deletedDeposit = await Deposit.findById(deposit._id)
    expect(deletedDeposit).toBe(null)
  })
})

describe("Deposit Model: Deposit.getDeposits", ()=>{
  let numberOfDepositors = 2
  let numberOfDeposits = 500
  let depositors = UserMocks.generateDBUsers(numberOfDepositors)
  let deposits = Mocks.generateDBDeposits(numberOfDeposits, depositors)

  beforeAll(async()=>{
    //delete any existing deposits and depositors
    await mongoose.connection.dropDatabase()
    await User.insertMany(depositors)
    await Deposit.insertMany(deposits)
  })

  test("no args - should sort and return the first 20 deposits sorted by date in descending order", async ()=>{
    //expected deposits ids 
    let perPage = 20
    let page = 1
    let expectedDepositsIds = [...deposits]
    .sort((a, b)=>b.date - a.date)
    .slice((page - 1) * perPage, perPage)
    .map((deposit)=>deposit._id)

    //actual deposit ids
    let actualDepositsIds = (await Deposit.getDeposits())
    .map((deposit)=>deposit._id)

    //expect(actualDepositsIds).toEqual(expectedDepositsIds)
  })

  test("all args passed - should return the deposits based on the filter, sort, and pagination", async ()=>{
    let filter = {
      userId: depositors[0]._id, 
      year: 2024, 
      month: 1
    }
    let sort = {field: "date", order: 1}
    let pagination = {page: 1, perPage: 5}

    //expected deposits ids 
    let expectedDeposits = [...deposits]
    .filter((deposit)=>{
      const depositYear = new Date(deposit.date).getFullYear()
      const depositMonth = new Date(deposit.date).getMonth() + 1 //1-based index to match mongodb $month operator
      return depositYear == filter.year && 
      depositMonth == filter.month &&
      deposit.depositor._id == filter.userId
    })
    .sort((a, b)=> sort.order * (a[sort.field] - b[sort.field]))
    .slice((pagination.page - 1) * pagination.perPage,  pagination.page * pagination.perPage)

    let expectedDepositsIds = expectedDeposits
    .map((deposit)=>deposit._id)

    //actual deposit ids
    let actualDeposits = (await Deposit.getDeposits(filter, sort, pagination))

    let actualDepositsIds = actualDeposits
    .map((deposit)=>deposit._id)

    console.log("actual", actualDeposits)

    //expect(actualDepositsIds).toEqual(expectedDepositsIds)
  })

})

//Yearly Deposit Model
describe("YearlyDeposit Model", ()=>{
  let yearlyDeposit
  beforeAll(async()=>{
    await mongoose.connection.dropDatabase()
    yearlyDeposit = Mocks.generateDBYearlyDeposit()
    await YearlyDeposit.create(yearlyDeposit)
  })

  test("YearlyDeposit.create should insert a new yearly deposit in collection", async ()=>{
    const insertedYearlyDeposit = await YearlyDeposit.findOne({year: yearlyDeposit.year})
    expect(insertedYearlyDeposit).not.toBe(null)
  })

  test("YearlyDeposit.updateOne should update yearly deposit", async ()=>{
    await YearlyDeposit.updateOne(
      { year: yearlyDeposit.year },
      {
        $inc: {
          total: 1_000,
          "monthTotals.0": 1_000
        },
      },
    )
    const updatedYearlyDeposit = await YearlyDeposit.findOne({year: yearlyDeposit.year})
    const expectedUpdatedMonthTotals = [...yearlyDeposit.monthTotals]
    expectedUpdatedMonthTotals[0] += 1_000

    expect(updatedYearlyDeposit.total).toEqual(yearlyDeposit.total + 1_000)
    expect(updatedYearlyDeposit.monthTotals).toEqual(expectedUpdatedMonthTotals)
  })

})