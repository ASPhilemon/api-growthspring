import { jest } from '@jest/globals';
import mongoose from "mongoose";

import { Withdraw } from "../models.js"
import * as Mocks from "./mocks.js";
import * as UserMocks from "../../user-service/__tests__/mocks.js";
import { User } from "../../user-service/models.js"
import connectDB from '../../../db.js';

beforeAll(async()=>{
  const MONGODB_URI = globalThis.__MONGO_URI__
  await connectDB(MONGODB_URI)
})

afterAll(async()=>{
  await mongoose.disconnect()
})

beforeEach(() => {
  jest.clearAllMocks();
});

//Withdraw Model Write Operations
describe("Withdraw Model:Write Operations", ()=>{
  let withdraw, withdrawnBy

  beforeAll(async()=>{
    await mongoose.connection.dropDatabase()
    withdrawnBy = UserMocks.generateDBUser()
    withdraw = Mocks.generateDBWithdraw({withdrawnBy})
    await Withdraw.create(withdraw)
  })

  test("Withdraw.create should insert a new withdraw in collection", async ()=>{
    const insertedWithdraw = await Withdraw.findById(withdraw._id)
    expect(insertedWithdraw).not.toBe(null)
  })

  test("Withdraw.updateOne should update existing withdraw", async ()=>{
    await Withdraw.updateOne({_id: withdraw._id}, {$set: {amount: 1_000}})
    const updatedWithdraw = await Withdraw.findById(withdraw._id)
    expect(updatedWithdraw.amount).toEqual(1_000)
  })

  test("Withdraw.deleteOne should delete withdraw", async ()=>{
    await Withdraw.deleteOne({_id: withdraw._id})
    const deletedWithdraw = await Withdraw.findById(withdraw._id)
    expect(deletedWithdraw).toBe(null)
  })
})

//Withdraw Model Read Operations
describe("Withdraw Model: Withdraw.getWithdraws", ()=>{
  const numberOfWithdrawers = 2
  const numberOfWithdraws = 500
  const withdrawers = UserMocks.generateDBUsers({numberOfUsers: numberOfWithdrawers})
  const withdraws = Mocks.generateDBWithdraws({numberOfWithdraws, withdrawers})

  beforeAll(async()=>{
    //Delete any existing withdraws and withdrawnBys
    await mongoose.connection.dropDatabase()
    await User.insertMany(withdrawers)
    await Withdraw.insertMany(withdraws)
  }, 20_000)

  test("no args - should sort and return the first 20 withdraws sorted by date in descending order", async ()=>{
    //Expected withdraws ids 
    const defaultPerPage = 20
    const expectedWithdrawsIds = [...withdraws]
    .sort((a, b)=>b.date - a.date)
    .slice(0, defaultPerPage)
    .map((withdraw)=> withdraw._id)

    //Actual withdraw ids
    const actualWithdrawsIds = (await Withdraw.getWithdraws())
    .map((withdraw)=>withdraw._id)

    expect(actualWithdrawsIds).toEqual(expectedWithdrawsIds)
  })

  test("all args passed - should return the withdraws based on the filter, sort, and pagination", async ()=>{
    const filter = {
      userId: withdrawers[0]._id, 
      year: 2024, 
      month: 5
    }
    const sort = {field: "amount", order: 1}
    const pagination = {page: 2, perPage: 5}

    //Expected withdraws ids 
    const expectedWithdrawsIds = [...withdraws]
    .filter((withdraw)=>{
      const withdrawYear = new Date(withdraw.date).getUTCFullYear()
      const withdrawMonth = new Date(withdraw.date).getUTCMonth() + 1 //1-based index to match mongodb $month operator
      return withdrawYear == filter.year && 
      withdrawMonth == filter.month &&
      withdraw.withdrawnBy._id == filter.userId
    })
    .sort((a, b)=> sort.order * (a[sort.field] - b[sort.field]))
    .slice((pagination.page - 1) * pagination.perPage,  pagination.page * pagination.perPage)
    .map((withdraw)=>withdraw._id)

    //Actual withdraw ids
    const actualWithdrawsIds = (await Withdraw.getWithdraws(filter, sort, pagination))
    .map((withdraw)=>withdraw._id)

    expect(actualWithdrawsIds).toEqual(expectedWithdrawsIds)
  })

})