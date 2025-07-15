import { jest } from '@jest/globals';
import mongoose from "mongoose";
import connectDB from "../../../db.js"

import {Deposit, YearlyDeposit} from "../models.js"
import * as Mocks from "./mocks.js";

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
  let dbUser, dbDeposit

  beforeEach(async()=>{
    await Deposit.deleteMany()
    dbUser = Mocks.createDBUser()
    dbDeposit = Mocks.createDBDeposit(dbUser, "Permanent")
    await Deposit.create(dbDeposit)
  })

  test("Deposit.create should insert a new deposit in collection", async ()=>{
    const deposit = await Deposit.findById(dbDeposit._id)
    expect(deposit).not.toBe(null)
  })

  test("Deposit.updateOne should update existing deposit", async ()=>{
    await Deposit.updateOne({_id: dbDeposit._id}, {$set: {amount: 1000}})
    let deposit = await Deposit.findById(dbDeposit._id)
    expect(deposit.amount).toEqual(1000)
  })

  test("Deposit.deleteOne should delete deposit", async ()=>{
    await Deposit.deleteOne({_id: dbDeposit._id})
    const deposit = await Deposit.findById(dbDeposit._id)
    expect(deposit).toBe(null)
  })
})

describe("YearlyDeposit Model", ()=>{
  beforeEach(async()=>{
    await YearlyDeposit.deleteMany()
    await YearlyDeposit.create({
      year: 2025,
      total: 1_000,
      monthTotals: [1_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    })
  })

  test("YearlyDeposit.create should create a new yearly deposit in collection", async ()=>{
    const yearlyDeposit = await YearlyDeposit.findOne({year: 2025})
    expect(yearlyDeposit).not.toBe(null)
  })

  test("YearlyDeposit.updateOne should update yearly deposit", async ()=>{
    await YearlyDeposit.updateOne(
      { year: 2025 },
      {
        $inc: {
          total: 1_000,
          "monthTotals.0": 1_000
        },
      },
    )
    const yearlyDeposit = await YearlyDeposit.findOne({year: 2025})
    expect(yearlyDeposit.total).toEqual(2_000)
    expect(yearlyDeposit.monthTotals).toEqual([2_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ])
  })

})