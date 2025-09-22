import { jest } from '@jest/globals';
import mongoose from "mongoose";

import { PointTransaction } from "../models.js"
import * as Mocks from "./mocks.js";
import * as UserMocks from "./../../user-service/__tests__/mocks.js";
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

//Point Transaction Model
describe("PointTransaction Model:Write Operations", ()=>{

  beforeEach(async()=>{
    await mongoose.connection.dropDatabase()
  })

  test("PointTransaction.create:award should insert a new transaction  in collection", async ()=>{
    const transaction = Mocks.generateDBAwardTransaction()
    await PointTransaction.create(transaction)
    const insertedTransaction = await PointTransaction.findById(transaction._id)
    expect(insertedTransaction).not.toBe(null)
  })

  test("PointTransaction.create:redeem should insert a new transaction  in collection", async ()=>{
    const transaction = Mocks.generateDBRedeemTransaction()
    await PointTransaction.create(transaction)
    const insertedTransaction = await PointTransaction.findById(transaction._id)
    expect(insertedTransaction).not.toBe(null)
  })

  test("PointTransaction.create:transfer should insert a new transaction  in collection", async ()=>{
    const transaction = Mocks.generateDBTransferTransaction()
    await PointTransaction.create(transaction)
    const insertedTransaction = await PointTransaction.findById(transaction._id)
    expect(insertedTransaction).not.toBe(null)
  })

  test("PointTransaction.updateOne should update existing transaction", async ()=>{
    const transaction = Mocks.generateDBAwardTransaction()
    await PointTransaction.create(transaction)
    await PointTransaction.updateOne({_id: transaction._id}, {$set: {points: 100}})
    let updatedTransaction = await PointTransaction.findById(transaction._id)
    expect(updatedTransaction.points).toEqual(100)
  })

  test("PointTransaction.deleteOne should delete transaction", async ()=>{
    const transaction = Mocks.generateDBAwardTransaction()
    await PointTransaction.create(transaction)
    await PointTransaction.deleteOne({_id: transaction._id})
    const deletedTransaction = await PointTransaction.findById(transaction._id)
    expect(deletedTransaction).toBe(null)
  })
})

describe("PointTransaction Model: PointTransaction.getTransactions", ()=>{
  let numberOfUsers = 2
  let numberOfTransactions = 1_000
  let users = UserMocks.generateDBUsers({numberOfUsers})
  let transactions = Mocks.generateDBTransactions(numberOfTransactions, {users})

  beforeAll(async()=>{
    //delete any existing records
    await mongoose.connection.dropDatabase()
    await PointTransaction.insertMany(transactions)
  }, 20_000)

  test("no args - should sort and return the first 20 transactions sorted by date in descending order", async ()=>{
    //expected transactions ids 
    let defaultPerPage = 20
    let expectedTransactionsIds = [...transactions]
    .sort((a, b)=>b.date - a.date)
    .slice(0, defaultPerPage)
    .map((transaction)=> transaction._id)

    //actual transactions ids
    let actualTransactionsIds = (await PointTransaction.getTransactions())
    .map((transaction)=>transaction._id.toString())

    expect(actualTransactionsIds).toEqual(expectedTransactionsIds)
  })

  test("all args passed - should return the transactions based on the filter, sort, and pagination", async ()=>{
    let filter = {
      userId: users[0]._id,
      type: "award",
      year: 2024, 
      month: 1
    }
    let sort = {field: "date", order: 1}
    let pagination = {page: 1, perPage: 5}
    //expected transactions ids 
    let expectedTransactionsIds = [...transactions]
    .filter((transaction)=>{
      const transactionYear = new Date(transaction.date).getUTCFullYear()
      const transactionMonth = new Date(transaction.date).getUTCMonth() + 1 //1-based index to match mongodb $month operator
      return transactionYear == filter.year && 
      transactionMonth == filter.month &&
       (
        transaction.recipient?._id == filter.userId ||
        transaction.sender?._id == filter.userId ||
        transaction.redeemedBy?._id == filter.userId
      ) &&
      transaction.type == filter.type
    })
    .sort((a, b)=> sort.order * (a[sort.field] - b[sort.field]))
    .slice((pagination.page - 1) * pagination.perPage,  pagination.page * pagination.perPage)
    .map((transaction)=>transaction._id)

    //actual transaction ids
    let actualTransactionsIds = (await PointTransaction.getTransactions(filter, sort, pagination))
    .map((transaction)=>transaction._id.toString())
    expect(actualTransactionsIds).toEqual(expectedTransactionsIds)
  })
})