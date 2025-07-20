import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from "supertest";
import cookie from "cookie";
import { v4 as uuid } from 'uuid';
import dotenv from "dotenv"
import * as Mocks from './mocks.js';
import * as CashLocationMocks from '../../cash-location-service/__tests__/mocks.js';
import * as UserMocks from '../../user-service/__tests__/mocks.js';
import { Deposit, YearlyDeposit } from '../models.js';
import { CashLocation } from '../../cash-location-service/models.js';
import { User } from '../../user-service/models.js';
import connectDB from "../../../db.js"

//load environment variables
dotenv.config()

// mock email service
let EmailServiceManager = await import('../../email-service/service.js')
jest.unstable_mockModule('../../email-service/service.js', () => {
  return {
    ...EmailServiceManager,
    sendEmail: jest.fn(),
  }
})
EmailServiceManager = await import('../../email-service/service.js')

//mock DateUtil
let DateUtil = await import('../../../utils/date-util.js')
jest.unstable_mockModule('../../../utils/date-util.js', async () => {
  return {
    ...DateUtil,
    getToday: jest.fn(()=>new Date("2025-06-01"))
  }
})
DateUtil = await import('../../../utils/date-util.js')

const { createJWT } = await import('../../auth-service/service.js')

//import test app
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

const BASE_PATH = "/deposits"

describe("GET /deposits", ()=>{
  let depositors, numberOfDepositors
  let deposits, numberOfDeposits
  let adminUser, jwt

  beforeAll(async()=>{
    //remove any existing depositors and deposits
    await mongoose.connection.db.dropDatabase()

    //insert depositors and deposits into database
    numberOfDepositors = 2
    numberOfDeposits = 500
    depositors = UserMocks.generateDBUsers(numberOfDepositors)
    deposits = Mocks.generateDBDeposits(numberOfDeposits, depositors)
    await User.insertMany(depositors)
    await Deposit.insertMany(deposits)

    //set jwt
    adminUser = UserMocks.generateDBUser("admin")
    let {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  })

  test("no query params - should return the first 20 sorted deposits, sorted by date in descending order", async ()=>{
    //send api request
    let endpoint = BASE_PATH
    let response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //expected deposits ids 
    let defaultPerPage = 20
    let expectedDepositsIds = [...deposits]
    .sort((a, b)=>b.date - a.date)
    .slice(0, defaultPerPage)
    .map((deposit)=>deposit._id)

    //actual deposit ids
    let actualDepositsIds = response.body.data
    .map((deposit)=>deposit._id)

    expect(actualDepositsIds).toEqual(expectedDepositsIds)
  })

  test("all query params passed - should return the deposits based on the passed params", async ()=>{
    //query params
    let query = {
      userId: depositors[0]._id,
      year: 2024,
      month: 1,
      sortBy: "amount",
      sortOrder: 1,
      page:  2,
      perPage: 5,
    }

    let queryString = new URLSearchParams(query).toString();

    //send api request
    const endpoint = BASE_PATH + "?" + queryString
    let response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //expected deposits ids 
    let expectedDepositsIds = [...deposits]
    .filter((deposit)=>{
      const depositYear = new Date(deposit.date).getUTCFullYear()
      const depositMonth = new Date(deposit.date).getUTCMonth() + 1 //1-based index to match mongodb $month operator
      return depositYear == query.year && 
      depositMonth == query.month &&
      deposit.depositor._id == query.userId
    })
    .sort((a, b)=> query.sortOrder * (a[query.sortBy] - b[query.sortBy]))
    .slice((query.page - 1) * query.perPage,  query.page * query.perPage)
    .map((deposit)=>deposit._id)

    //actual deposit ids
    let actualDepositsIds = response.body.data
    .map((deposit)=>deposit._id)

    expect(actualDepositsIds).toEqual(expectedDepositsIds)
  })

})

describe("POST /deposits: Permanent Deposit", ()=>{
  let currentDepositor, adminUser
  let mobileMoneyCashLocation, standardCharteredCashLocation, currentDepositCashLocation
  let deposit
  let jwt, endpoint, response
  
  beforeAll(async()=>{
    //remove any existing records in database
    await mongoose.connection.db.dropDatabase()

    currentDepositor = UserMocks.generateDBUser()
    mobileMoneyCashLocation = CashLocationMocks.generateDBCashLocation()
    standardCharteredCashLocation = CashLocationMocks.generateDBCashLocation()

    //use mobile money cash location for the deposit
    currentDepositCashLocation = mobileMoneyCashLocation
    const {_id , name} = currentDepositCashLocation
    deposit = Mocks.generateInputDeposit(currentDepositor, "Permanent", {_id, name})

    //insert cash locations and depositor into database
    await User.create(currentDepositor)
    await CashLocation.insertMany([
      mobileMoneyCashLocation,
      standardCharteredCashLocation,
    ])

    //send api request
    endpoint = BASE_PATH
    adminUser = UserMocks.generateDBUser("admin")
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
    response = await request(app).post(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(deposit)
  })

  test("a new deposit is inserted to database", async ()=>{
    const insertedDeposit = await Deposit.findById(deposit._id)
    expect(insertedDeposit).not.toBe(null)
  })

  test("user.permanentInvestment is updated", async ()=>{
    const daysInvestment = DateUtil.getDaysDifference(currentDepositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())

    const updatedUnits = currentDepositor.permanentInvestment.units 
    + currentDepositor.permanentInvestment.amount * daysInvestment 
    + deposit.amount * daysDeposit
    const updatedInvestmentAmount = currentDepositor.permanentInvestment.amount + deposit.amount

    const updatedDepositor = await User.findById(currentDepositor._id).lean()

    expect(updatedDepositor.permanentInvestment).toEqual({
      amount: updatedInvestmentAmount,
      units: updatedUnits,
      unitsDate: DateUtil.getToday()
    })
  })

  test("user.points is updated", async ()=>{
    const updatedDepositor = await User.findById(currentDepositor._id)
    const pointsAwarded = Math.floor(deposit.amount / 10_000 * 3)
    expect(updatedDepositor.points).toEqual(currentDepositor.points + pointsAwarded)
  })

  test("deposit cash location is updated", async ()=>{
    const updatedDepositCashLocation = await CashLocation.findById(currentDepositCashLocation._id)
    expect(updatedDepositCashLocation.amount).toEqual(currentDepositCashLocation.amount + deposit.amount)
  })

  test("response.ok is true and error is null", async ()=>{
    expect(response.body.error).toBe(null)
    expect(response.ok).toBe(true)
  })

  test("a new yealy deposit is inserted to database", async ()=>{
    const insertedYearlyDeposit = await YearlyDeposit.findOne({year: new Date(deposit.date).getFullYear()})
    expect(insertedYearlyDeposit).not.toBe(null)
  })

  test("the yealy deposit is updated", async ()=>{
    const secondDeposit = {...deposit, _id: uuid()}
    await request(app).post(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(secondDeposit)

    const updatedYearlyDeposit = await YearlyDeposit.findOne({year: new Date(deposit.date).getFullYear()}).lean()
    const {total: updatedTotal, monthTotals: updatedMonthTotals} = updatedYearlyDeposit

    const expectedUpdatedTotal = deposit.amount * 2
    const expectedUpdatedMonthTotals = new Array(12).fill(0)
    const updatedMonth = new Date(deposit.date).getMonth()
    expectedUpdatedMonthTotals[updatedMonth] = deposit.amount * 2

    expect(updatedTotal).toEqual(expectedUpdatedTotal)
    expect(updatedMonthTotals).toEqual(expectedUpdatedMonthTotals)
  })

})

describe("POST /deposits: Temporary Deposit", ()=>{
  let currentDepositor, adminUser
  let mobileMoneyCashLocation, standardCharteredCashLocation, currentDepositCashLocation
  let deposit
  let jwt, endpoint, response
  
  beforeAll(async()=>{
    //remove any existing records in database
    await mongoose.connection.db.dropDatabase()

    currentDepositor = UserMocks.generateDBUser()
    mobileMoneyCashLocation = CashLocationMocks.generateDBCashLocation()
    standardCharteredCashLocation = CashLocationMocks.generateDBCashLocation()

    //use mobile money cash location for the deposit
    currentDepositCashLocation = mobileMoneyCashLocation
    const {_id , name} = currentDepositCashLocation
    deposit = Mocks.generateInputDeposit(currentDepositor, "Temporary", {_id, name})

    //insert cash locations and depositor into database
    await User.create(currentDepositor)
    await CashLocation.insertMany([
      mobileMoneyCashLocation,
      standardCharteredCashLocation,
    ])

    //send api request
    endpoint = BASE_PATH
    adminUser = UserMocks.generateDBUser("admin")
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
    response = await request(app).post(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(deposit)
  })

  test("a new deposit is inserted to database", async ()=>{
    const insertedDeposit = await Deposit.findById(deposit._id)
    expect(insertedDeposit).not.toBe(null)
  })

  test("user.temporaryInvestment is updated", async ()=>{
    const daysInvestment = DateUtil.getDaysDifference(currentDepositor.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())

    const updatedUnits = currentDepositor.temporaryInvestment.units 
    + currentDepositor.temporaryInvestment.amount * daysInvestment 
    + deposit.amount * daysDeposit
    const updatedInvestmentAmount = currentDepositor.temporaryInvestment.amount + deposit.amount

    const updatedDepositor = await User.findById(currentDepositor._id).lean()

    expect(updatedDepositor.temporaryInvestment).toEqual({
      amount: updatedInvestmentAmount,
      units: updatedUnits,
      unitsDate: DateUtil.getToday()
    })
  })

  test("user.points stays the same", async ()=>{
    const updatedDepositor = await User.findById(currentDepositor._id)
    expect(updatedDepositor.points).toEqual(currentDepositor.points)
  })

  test("deposit cash location is updated", async ()=>{
    const updatedDepositCashLocation = await CashLocation.findById(currentDepositCashLocation._id)
    expect(updatedDepositCashLocation.amount).toEqual(currentDepositCashLocation.amount + deposit.amount)
  })

  test("response.ok is true and error is null", async ()=>{
    expect(response.body.error).toBe(null)
    expect(response.ok).toBe(true)
  })

  test("a new yealy deposit is not inserted to database", async ()=>{
    const insertedYearlyDeposit = await YearlyDeposit.findOne({year: new Date(deposit.date).getFullYear()})
    expect(insertedYearlyDeposit).toBe(null)
  })
})
