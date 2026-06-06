import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from "supertest";
import cookie from "cookie";
import dotenv from "dotenv"
import * as Mocks from './mocks.js';

import * as UserMocks from '../../user-service/__tests__/mocks.js';
import { CashLocation, CashLocationTransfer } from '../models.js';
import connectDB from "../../../db.js"

//Load environment variables
dotenv.config()

// Mock email service
let EmailService = await import('../../email-service/service.js')
jest.unstable_mockModule('../../email-service/service.js', () => ({
    ...EmailService,
    sendEmail: jest.fn(),
  }))
EmailService = await import('../../email-service/service.js')

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

const BASE_PATH = "/cash-locations"

describe("GET /cash-locations", ()=>{
  let cashLocations
  let adminUser, jwt

  beforeAll(async()=>{
    //Remove any existing cashLocationers and cashLocations
    await mongoose.connection.db.dropDatabase()

    cashLocations = Mocks.generateDBCashLocations()
    await CashLocation.insertMany(cashLocations)

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  })

  test("should return all cash locations", async ()=>{
    //Send api request
    const endpoint = BASE_PATH
    const response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //Expected cashLocations ids 
    const expectedCashLocationsIds = cashLocations
    .map((cashLocation)=>cashLocation._id)

    //Actual cashLocation ids
    const actualCashLocationsIds = response.body.data
    .map((cashLocation)=>cashLocation._id)

    expect(actualCashLocationsIds).toEqual(expectedCashLocationsIds)
  })

})

describe("GET /cash-location-123", ()=>{
  let cashLocation
  let adminUser, jwt

  beforeAll(async()=>{
    //Remove any existing cashLocationers and cashLocations
    await mongoose.connection.db.dropDatabase()

    cashLocation = Mocks.generateDBCashLocation()
    await CashLocation.create(cashLocation)

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  })

  test("should return inserted cash location", async ()=>{
    //Send api request
    const endpoint = `${BASE_PATH  }/${  cashLocation._id}`
    const response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    const insertedCashLocationId = response.body.data._id

    expect(insertedCashLocationId).toEqual(cashLocation._id)
  })

})

describe("PUT /cash-locations/:id", ()=>{
  let cashLocationUpdate, currentCashLocation
  let adminUser, jwt
  let endpoint, response
  
  beforeAll(async()=>{
    //Remove any existing records in database
    await mongoose.connection.db.dropDatabase()

    currentCashLocation = Mocks.generateDBCashLocation()
    cashLocationUpdate = Mocks.generateCashLocationUpdate()
    await CashLocation.create(currentCashLocation)

    adminUser = UserMocks.generateDBUser({userType: "admin"})

    //Send api request
    endpoint = `${BASE_PATH  }/${  currentCashLocation._id}`
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
    response = await request(app).put(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(cashLocationUpdate)
  })

  test("cash location is updated", async ()=>{
    const updatedCashLocation = await CashLocation.findById(currentCashLocation._id)
    expect(updatedCashLocation.amount).toEqual(cashLocationUpdate.amount)
  })

  test("response.ok is true and error is null", async ()=>{
    expect(response.body.error).toBe(null)
    expect(response.ok).toBe(true)
  })

})

describe("GET /cash-locations/transfers", ()=>{
  let transfers
  let adminUser, jwt

  beforeAll(async()=>{
    //Remove any existing transferers and transfers
    await mongoose.connection.db.dropDatabase()

    transfers = Mocks.generateTransfers()
    await CashLocationTransfer.insertMany(transfers)

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  })

  test("should return all transfers", async ()=>{
    //Send api request
    const endpoint = `${BASE_PATH  }/transfers`
    const response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //Expected transfers ids 
    const expectedTransfersIds = transfers
    .map((transfer)=>transfer._id)

    //Actual transfer ids
    const actualTransfersIds = response.body.data
    .map((transfer)=>transfer._id)

    expect(actualTransfersIds).toEqual(expectedTransfersIds)
  })

})

describe("GET /cash-locations/transfers/transfer-123", ()=>{
  let transfer
  let adminUser, jwt

  beforeAll(async()=>{
    //Remove any existing transferers and transfers
    await mongoose.connection.db.dropDatabase()

    transfer = Mocks.generateTransfer()
    await CashLocationTransfer.create(transfer)

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  })

  test("should return inserted transfer", async ()=>{
    //Send api request
    const endpoint = `${BASE_PATH   }/transfers/${  transfer._id}`
    const response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    const insertedTransferId = response.body.data._id

    expect(insertedTransferId).toEqual(transfer._id)
  })

})

describe("POST /cash-locations/transfers", ()=>{
  let transfer
  let adminUser, endpoint, jwt, response
  let currentSourceCashLocation
  let currentDestCashLocation

  beforeAll(async()=>{
    //Remove any existing transferers and transfers
    await mongoose.connection.db.dropDatabase()

    currentDestCashLocation = Mocks.generateDBCashLocation()
    currentSourceCashLocation = Mocks.generateDBCashLocation()

    transfer = Mocks.generateTransfer(currentSourceCashLocation, currentDestCashLocation)

    await CashLocation.insertMany([
      currentSourceCashLocation,
      currentDestCashLocation
    ])

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

    endpoint = `${BASE_PATH   }/transfers`

    //Send api request
    response = await request(app).post(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(transfer)

  })

  test("should create transfer", async ()=>{
    const insertedTransfer = await CashLocationTransfer.findOne()
    expect(insertedTransfer).not.toBe(null)
  })

  test("should update source cash location", async ()=>{
    const updatedCashLocation = await CashLocation.findById(currentSourceCashLocation._id)
    expect(updatedCashLocation.amount).toBe(currentSourceCashLocation.amount - transfer.amount)
  })

  test("should update dest cash location", async ()=>{
    const updatedCashLocation = await CashLocation.findById(currentDestCashLocation._id)
    expect(updatedCashLocation.amount).toBe(currentDestCashLocation.amount + transfer.amount)
  })

})

describe("PUT /cash-locations/transfers/transfer-123", ()=>{
  let currentTransfer
  let adminUser, endpoint, jwt, response
  let currentSourceCashLocation
  let currentDestCashLocation
  let transferUpdate

  beforeAll(async()=>{
    //Remove any existing transferers and transfers
    await mongoose.connection.db.dropDatabase()

    currentDestCashLocation = Mocks.generateDBCashLocation()
    currentSourceCashLocation = Mocks.generateDBCashLocation()

    currentTransfer = Mocks.generateTransfer(currentSourceCashLocation, currentDestCashLocation)
    await CashLocationTransfer.create(currentTransfer)

    await CashLocation.insertMany([
      currentSourceCashLocation,
      currentDestCashLocation
    ])

    transferUpdate = Mocks.generateTransferUpdate()

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

    endpoint = `${BASE_PATH   }/transfers/${  currentTransfer._id}`

    //Send api request
    response = await request(app).put(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))
    .send(transferUpdate)

  })

  test("should update transfer", async ()=>{
    const updatedTransfer = await CashLocationTransfer.findOne()
    expect(updatedTransfer.amount).toEqual(transferUpdate.amount)
  })

  test("should update source cash location", async ()=>{
    const updatedCashLocation = await CashLocation.findById(currentSourceCashLocation._id)
    expect(updatedCashLocation.amount).toBe(currentSourceCashLocation.amount + currentTransfer.amount - transferUpdate.amount)
  })

  test("should update dest cash location", async ()=>{
    const updatedCashLocation = await CashLocation.findById(currentDestCashLocation._id)
    expect(updatedCashLocation.amount).toBe(currentDestCashLocation.amount - currentTransfer.amount + transferUpdate.amount)
  })

})

describe("DELETE /cash-locations/transfers/transfer-123", ()=>{
  let transfer
  let adminUser, endpoint, jwt, response
  let currentSourceCashLocation
  let currentDestCashLocation

  beforeAll(async()=>{
    //Remove any existing transferers and transfers
    await mongoose.connection.db.dropDatabase()

    currentDestCashLocation = Mocks.generateDBCashLocation()
    currentSourceCashLocation = Mocks.generateDBCashLocation()

    transfer = Mocks.generateTransfer(currentSourceCashLocation, currentDestCashLocation)
    await CashLocationTransfer.create(transfer)

    await CashLocation.insertMany([
      currentSourceCashLocation,
      currentDestCashLocation
    ])

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

    endpoint = `${BASE_PATH   }/transfers/${  transfer._id}`

    //Send api request
    response = await request(app).delete(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

  })

  test("should delete transfer", async ()=>{
    const deletedTransfer = await CashLocationTransfer.findOne()
    expect(deletedTransfer).toBe(null)
  })

  test("should update source cash location", async ()=>{
    const updatedCashLocation = await CashLocation.findById(currentSourceCashLocation._id)
    expect(updatedCashLocation.amount).toBe(currentSourceCashLocation.amount + transfer.amount)
  })

  test("should update dest cash location", async ()=>{
    const updatedCashLocation = await CashLocation.findById(currentDestCashLocation._id)
    expect(updatedCashLocation.amount).toBe(currentDestCashLocation.amount - transfer.amount)
  })

})