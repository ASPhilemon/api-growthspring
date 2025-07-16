import { jest } from '@jest/globals';
import mongoose from "mongoose";
import connectDB from "../../../db.js"

import {Deposit, YearlyDeposit} from "../models.js"
import * as Mocks from "./mocks.js";
import * as UserMocks from "../../user-service/__tests__/mocks.js";

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

describe("Deposit Model", ()=>{
  let depositor, deposit

  beforeEach(async()=>{
    await Deposit.deleteMany()
    depositor = UserMocks.createDBUser()
    deposit = Mocks.createDBDeposit(depositor, "Permanent")
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

describe("YearlyDeposit Model", ()=>{
  let yearlyDeposit
  beforeEach(async()=>{
    await YearlyDeposit.deleteMany()
    yearlyDeposit = Mocks.createDBYearlyDeposit()
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