import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from "supertest";
import cookie from "cookie";
import dotenv from "dotenv"
import * as Mocks from './mocks.js';
import * as CashLocationMocks from '../../cash-location-service/__tests__/mocks.js';
import * as UserMocks from '../../user-service/__tests__/mocks.js';
import { Withdraw } from '../models.js';
import { CashLocation } from '../../cash-location-service/models.js';
import { User } from '../../user-service/models.js';
import connectDB from "../../../db.js"

//Load environment variables
dotenv.config()

// Mock email service
let EmailServiceManager = await import('../../email-service/service.js')
jest.unstable_mockModule('../../email-service/service.js', () => ({
    ...EmailServiceManager,
    sendEmail: jest.fn(),
  }))
EmailServiceManager = await import('../../email-service/service.js')

//Mock DateUtil
let DateUtil = await import('../../../utils/date-util.js')
jest.unstable_mockModule('../../../utils/date-util.js', async () => ({
    ...DateUtil,
    getToday: jest.fn(()=>new Date("2025-06-01"))
  }))
DateUtil = await import('../../../utils/date-util.js')

const { createJWT } = await import('../../auth-service/service.js')

//Import test app
const app = (await import("../../../app.js")).default;

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

const BASE_PATH = "/withdraws"

describe("GET /withdraws", ()=>{
  let numberOfWithdrawers, withdrawers
  let numberOfWithdraws, withdraws
  let adminUser, jwt

  beforeAll(async()=>{
    //Remove any existing withdrawers and withdraws
    await mongoose.connection.db.dropDatabase()

    //Insert withdrawers and withdraws into database
    numberOfWithdrawers = 2
    numberOfWithdraws = 500
    withdrawers = UserMocks.generateDBUsers({numberOfWithdrawers})
    withdraws = Mocks.generateDBWithdraws({numberOfWithdraws, withdrawers})
    await User.insertMany(withdrawers)
    await Withdraw.insertMany(withdraws)

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  }, 20_000)

  test("no query params - should return the first 20 sorted withdraws, sorted by date in descending order", async ()=>{
    //Send api request
    const endpoint = BASE_PATH
    const response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //Expected withdraws ids 
    const defaultPerPage = 20
    const expectedWithdrawsIds = [...withdraws]
    .sort((a, b)=>b.date - a.date)
    .slice(0, defaultPerPage)
    .map((withdraw)=>withdraw._id)

    //Actual withdraw ids
    const actualWithdrawsIds = response.body.data
    .map((withdraw)=>withdraw._id)

    expect(actualWithdrawsIds).toEqual(expectedWithdrawsIds)
  })

  test("all query params passed - should return the withdraws based on the passed params", async ()=>{
    //Query params
    const query = {
      userId: withdrawers[0]._id,
      year: 2024,
      month: 1,
      sortBy: "amount",
      sortOrder: 1,
      page:  2,
      perPage: 5,
    }

    const queryString = new URLSearchParams(query).toString();

    //Send api request
    const endpoint = `${BASE_PATH  }?${  queryString}`
    const response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //Expected withdraws ids 
    const expectedWithdrawsIds = [...withdraws]
    .filter((withdraw)=>{
      const withdrawYear = new Date(withdraw.date).getUTCFullYear()
      const withdrawMonth = new Date(withdraw.date).getUTCMonth() + 1 //1-based index to match mongodb $month operator
      return withdrawYear == query.year && 
      withdrawMonth == query.month &&
      withdraw.withdrawnBy._id == query.userId
    })
    .sort((a, b)=> query.sortOrder * (a[query.sortBy] - b[query.sortBy]))
    .slice((query.page - 1) * query.perPage,  query.page * query.perPage)
    .map((withdraw)=>withdraw._id)

    //Actual withdraw ids
    const actualWithdrawsIds = response.body.data
    .map((withdraw)=>withdraw._id)

    expect(actualWithdrawsIds).toEqual(expectedWithdrawsIds)
  })

})

describe("POST /withdraws", ()=>{
  let adminUser, currentWithdrawer
  let currentWithdrawCashLocation, mobileMoneyCashLocation, standardCharteredCashLocation
  let withdraw
  let endpoint, jwt, response
  
  beforeAll(async()=>{
    //Remove any existing records in database
    await mongoose.connection.db.dropDatabase()

    currentWithdrawer = UserMocks.generateDBUser()
    mobileMoneyCashLocation = CashLocationMocks.generateDBCashLocation()
    standardCharteredCashLocation = CashLocationMocks.generateDBCashLocation()

    //Use mobile money cash location for the withdraw
    currentWithdrawCashLocation = mobileMoneyCashLocation
    withdraw = Mocks.generateInputWithdraw({
      withdrawnBy: currentWithdrawer,
      cashLocation: currentWithdrawCashLocation
    })

    //Insert cash locations and withdrawor into database
    await User.create(currentWithdrawer)
    await CashLocation.insertMany([
      mobileMoneyCashLocation,
      standardCharteredCashLocation,
    ])

    //Send api request
    endpoint = BASE_PATH
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
    response = await request(app).post(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(withdraw)
  })
  
  test("a new withdraw is inserted to database", async ()=>{
    const insertedWithdraw = await Withdraw.findById(withdraw._id)
    expect(insertedWithdraw).not.toBe(null)
  })

  test("user.temporaryInvestment is updated", async ()=>{
    const daysInvestment = DateUtil.getDaysDifference(currentWithdrawer.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysWithdraw = DateUtil.getDaysDifference(withdraw.date, DateUtil.getToday())

    const updatedUnits = currentWithdrawer.temporaryInvestment.units 
    + currentWithdrawer.temporaryInvestment.amount * daysInvestment 
    - withdraw.amount * daysWithdraw
    const updatedInvestmentAmount = currentWithdrawer.temporaryInvestment.amount - withdraw.amount

    const updatedWithdrawer = await User.findById(currentWithdrawer._id).lean()

    expect(updatedWithdrawer.temporaryInvestment).toEqual({
      amount: updatedInvestmentAmount,
      units: updatedUnits,
      unitsDate: DateUtil.getToday()
    })
  })

  test("withdraw cash location is updated", async ()=>{
    const updatedWithdrawCashLocation = await CashLocation.findById(currentWithdrawCashLocation._id)
    expect(updatedWithdrawCashLocation.amount).toEqual(currentWithdrawCashLocation.amount - withdraw.amount)
  })

  test("response.ok is true and error is null", async ()=>{
    expect(response.body.error).toBe(null)
    expect(response.ok).toBe(true)
  })

})

describe("PUT /withdraw/:id", ()=>{
  let adminUser, currentWithdrawer, recordedBy
  let mobileMoneyCashLocation, standardCharteredCashLocation
  let cashLocationToAdd, cashLocationToDeduct, currentWithdrawCashLocation
  let currentWithdraw, withdrawUpdate
  let currentPointTransaction
  let endpoint, jwt, response
  
  beforeAll(async()=>{
    //Remove any existing records in database
    await mongoose.connection.db.dropDatabase()

    currentWithdrawer = UserMocks.generateDBUser()
    mobileMoneyCashLocation = CashLocationMocks.generateDBCashLocation({
      name: "Mobile Money",
      amount: 10_000_000
    })
    standardCharteredCashLocation = CashLocationMocks.generateDBCashLocation({
      name: "Standard Chartered",
      amount: 12_000_000
    })
    adminUser = UserMocks.generateDBUser({userType: "admin"})

    //Use mobile money cash location for the current withdraw
    currentWithdrawCashLocation = mobileMoneyCashLocation
    recordedBy = adminUser
    currentWithdraw = Mocks.generateDBWithdraw({
      withdrawnBy: currentWithdrawer,
      recordedBy,
      cashLocation: currentWithdrawCashLocation
    })

    //Use mobile money cash location for cashLocationToDeduct
    //Use standard chartered cash location for cashLocationToAdd
    cashLocationToAdd = mobileMoneyCashLocation
    cashLocationToDeduct = standardCharteredCashLocation
    withdrawUpdate = Mocks.generateWithdrawUpdate({cashLocationToAdd, cashLocationToDeduct})

    //Insert withdrawer, current withdraw, and cashlocations into database
    await User.create(currentWithdrawer)
    await Withdraw.create(currentWithdraw)
    await CashLocation.insertMany([
      mobileMoneyCashLocation,
      standardCharteredCashLocation,
    ])

    //Send api request
    endpoint = `${BASE_PATH  }/${  currentWithdraw._id}`
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
    response = await request(app).put(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(withdrawUpdate)
  })

  test("current withdraw is updated", async ()=>{
    const updatedWithdraw = await Withdraw.findById(currentWithdraw._id)
    const updatedCashLocation = updatedWithdraw.cashLocation.toObject()
    expect(updatedWithdraw.date.toISOString()).toEqual(withdrawUpdate.date)
    expect(updatedWithdraw.amount).toEqual(withdrawUpdate.amount)
    expect(updatedCashLocation._id.toString())
    .toEqual(cashLocationToDeduct._id)
    expect(updatedCashLocation.name)
    .toEqual(cashLocationToDeduct.name)
  })

  test("user.temporaryInvestment is updated", async ()=>{
    const daysInvestment = DateUtil.getDaysDifference(currentWithdrawer.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysCurrentWithdraw = DateUtil.getDaysDifference(currentWithdraw.date, DateUtil.getToday())
    const daysUpdatedWithdraw = DateUtil.getDaysDifference(withdrawUpdate.date, DateUtil.getToday())

    const updatedUnits = currentWithdrawer.temporaryInvestment.units 
    + currentWithdrawer.temporaryInvestment.amount * daysInvestment 
    + currentWithdraw.amount * daysCurrentWithdraw
    - withdrawUpdate.amount * daysUpdatedWithdraw

    const updatedInvestmentAmount = currentWithdrawer.temporaryInvestment.amount
    + currentWithdraw.amount
    - withdrawUpdate.amount

    const updatedWithdrawer = await User.findById(currentWithdrawer._id).lean()

    expect(updatedWithdrawer.temporaryInvestment).toEqual({
      amount: updatedInvestmentAmount,
      units: updatedUnits,
      unitsDate: DateUtil.getToday()
    })
  })

  test("cashLocationToAdd is updated", async ()=>{
    const updatedCashLocation = await CashLocation.findById(cashLocationToAdd._id)
    expect(updatedCashLocation.amount).toEqual(cashLocationToAdd.amount + currentWithdraw.amount )
  })

  test("cashLocationToDeduct is updated", async ()=>{
    const updatedCashLocation = await CashLocation.findById(cashLocationToDeduct._id)
    expect(updatedCashLocation.amount).toEqual(cashLocationToDeduct.amount - withdrawUpdate.amount )
  })

  test("response.ok is true and error is null", async ()=>{
    expect(response.body.error).toBe(null)
    expect(response.ok).toBe(true)
  })

})

describe("DELETE /withdraw/:id", ()=>{
  let adminUser, currentWithdrawer
  let mobileMoneyCashLocation, standardCharteredCashLocation
  let cashLocationToAdd
  let withdraw
  let endpoint, jwt, response
  
  beforeAll(async()=>{
    //Remove any existing records in database
    await mongoose.connection.db.dropDatabase()

    currentWithdrawer = UserMocks.generateDBUser()
    mobileMoneyCashLocation = CashLocationMocks.generateDBCashLocation({
      name: "Mobile Money",
      amount: 10_000_000
    })
    standardCharteredCashLocation = CashLocationMocks.generateDBCashLocation({
      name: "Standard Chartered",
      amount: 12_000_000
    })
    adminUser = UserMocks.generateDBUser({userType:"admin"})

    withdraw = Mocks.generateDBWithdraw({
      withdrawnBy: currentWithdrawer,
    })

    //Use mobile money cash location for cashLocationToAdd
    cashLocationToAdd = mobileMoneyCashLocation

    //Insert withdrawer, withdraw and cashlocations into database
    await User.create(currentWithdrawer)
    await Withdraw.create(withdraw)
    await CashLocation.insertMany([
      mobileMoneyCashLocation,
      standardCharteredCashLocation,
    ])

    const {_id: cashLocationToAddId} = cashLocationToAdd

    //Send api request
    endpoint = `${BASE_PATH  }/${  withdraw._id}`
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
    response = await request(app).delete(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send({cashLocationToAddId})
  })

  test("withdraw is deleted", async ()=>{
    const deletedWithdraw = await Withdraw.findById(withdraw._id)
    expect(deletedWithdraw).toBe(null)
  })

  test("user.temporaryInvestment is updated", async ()=>{
    const daysInvestment = DateUtil.getDaysDifference(currentWithdrawer.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysWithdraw = DateUtil.getDaysDifference(withdraw.date, DateUtil.getToday())
    const updatedUnits = currentWithdrawer.temporaryInvestment.units 
    + currentWithdrawer.temporaryInvestment.amount * daysInvestment 
    + withdraw.amount * daysWithdraw

    const updatedInvestmentAmount = currentWithdrawer.temporaryInvestment.amount + withdraw.amount

    const updatedWithdrawer = await User.findById(currentWithdrawer._id).lean()

    expect(updatedWithdrawer.temporaryInvestment).toEqual({
      amount: updatedInvestmentAmount,
      units: updatedUnits,
      unitsDate: DateUtil.getToday()
    })
  })

  test("cashLocationToAdd is updated", async ()=>{
    const updatedCashLocation = await CashLocation.findById(cashLocationToAdd._id)
    expect(updatedCashLocation.amount).toEqual(cashLocationToAdd.amount + withdraw.amount )
  })

  test("response.ok is true and error is null", async ()=>{
    expect(response.body.error).toBe(null)
    expect(response.ok).toBe(true)
  })

})