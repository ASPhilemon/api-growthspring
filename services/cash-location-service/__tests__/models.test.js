import { jest } from '@jest/globals';
import mongoose from "mongoose";

import { CashLocation, CashLocationTransfer } from "../models.js"
import * as Mocks from "./mocks.js";
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

//Cash Location Model Write Operations
describe("CashLocation Model:Write Operations", ()=>{
  let cashLocation

  beforeAll(async()=>{
    await mongoose.connection.dropDatabase()
    cashLocation = Mocks.generateDBCashLocation()
    await CashLocation.create(cashLocation)
  })

  test("CashLocation.create should insert a new cashLocation in collection", async ()=>{
    const insertedCashLocation = await CashLocation.findById(cashLocation._id)
    expect(insertedCashLocation).not.toBe(null)
  })

  test("CashLocation.updateOne should update existing cashLocation", async ()=>{
    await CashLocation.updateOne({_id: cashLocation._id}, {$set: {amount: 1_000}})
    let updatedCashLocation = await CashLocation.findById(cashLocation._id)
    expect(updatedCashLocation.amount).toEqual(1_000)
  })

  test("CashLocation.deleteOne should delete cashLocation", async ()=>{
    await CashLocation.deleteOne({_id: cashLocation._id})
    const deletedCashLocation = await CashLocation.findById(cashLocation._id)
    expect(deletedCashLocation).toBe(null)
  })
})

//Cash Location Transfer Model Write Operations
describe("CashLocationTransfer Model:Write Operations", ()=>{
  let transfer

  beforeAll(async()=>{
    await mongoose.connection.dropDatabase()
    transfer = Mocks.generateTransfer()
    await CashLocationTransfer.create(transfer)
  })

  test("CashLocationTransfer.create should insert a new transfer in collection", async ()=>{
    const insertedTransfer = await CashLocationTransfer.findById(transfer._id)
    expect(insertedTransfer).not.toBe(null)
  })

  test("CashLocationTransfer.updateOne should update existing transfer", async ()=>{
    await CashLocationTransfer.updateOne({_id: transfer._id}, {$set: {amount: 1_000}})
    let updatedTransfer = await CashLocationTransfer.findById(transfer._id)
    expect(updatedTransfer.amount).toEqual(1_000)
  })

  test("CashLocationTransfer.deleteOne should delete transfer", async ()=>{
    await CashLocationTransfer.deleteOne({_id: transfer._id})
    const deletedTransfer = await CashLocationTransfer.findById(transfer._id)
    expect(deletedTransfer).toBe(null)
  })
})