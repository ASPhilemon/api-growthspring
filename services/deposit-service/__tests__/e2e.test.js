import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from "supertest";
import cookie from "cookie";
import dotenv from "dotenv"
import * as Mocks from './mocks.js';
import { Deposit } from '../models.js';
import { CashLocation } from '../../cash-location-service/models.js';
import { User } from '../../user-service/models.js';
import connectDB from "../../../db.js"

//load environment variables
dotenv.config()

// mock email service
jest.unstable_mockModule('../../email-service/service.js', () => {
  return {
    sendEmail: jest.fn(),
  }
})

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
  process.env.MONGODB_URI = process.env.MONGO_URL
  await connectDB()
})

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
});

const BASE_PATH = "/deposits"

describe("POST /deposits: Permanent Deposit", ()=>{
  console.log("in POST")
  let response, depositor, adminUser, dbCashLocation, inputCashLocation, inputDeposit
  beforeEach(async()=>{
    depositor = Mocks.createDBUser("regular")
    adminUser = Mocks.createDBUser("admin")
    inputCashLocation = Mocks.createInputCashLocation()
    inputDeposit = Mocks.createInputDeposit(depositor, "Permanent", inputCashLocation)

    //insert depositor and deposit cashlocation into collection
    await User.create(depositor)
    dbCashLocation = Mocks.createDBCashLocation(inputCashLocation._id, inputCashLocation.name)
    await CashLocation.create(dbCashLocation)

    const endpoint = BASE_PATH
    const {_id, fullName, isAdmin} = adminUser
    const jwt = createJWT(_id, fullName, isAdmin)
    response = await request(app).post(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(inputDeposit)
  })

  test("a new deposit is created", async ()=>{
    const deposit = await Deposit.findById(inputDeposit._id)
    expect(deposit).not.toBe(null)
  })

  test("response.ok is true and error is null", async ()=>{
    expect(response.body.error).toBe(null)
    expect(response.ok).toBe(true)
  })

  test("deposit cash location is updated", async ()=>{
    const cashLocation = await CashLocation.findById(dbCashLocation._id)
    expect(cashLocation.amount).toEqual(dbCashLocation.amount + inputDeposit.amount)
  })

  test("user.permanentInvestment is updated", async ()=>{
    const daysInvestment = DateUtil.getDaysDifference(depositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(inputDeposit.date, DateUtil.getToday())

    const updatedUnits = depositor.permanentInvestment.units 
    + depositor.permanentInvestment.amount * daysInvestment 
    + inputDeposit.amount * daysDeposit
    const updatedInvestmentAmount = depositor.permanentInvestment.amount + inputDeposit.amount

    const updatedUser = await User.findById(depositor._id).lean()

    expect(updatedUser.permanentInvestment).toEqual({
      amount: updatedInvestmentAmount,
      units: updatedUnits,
      unitsDate: DateUtil.getToday()
    })
  })

})