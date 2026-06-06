import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from "supertest";
import cookie from "cookie";
import dotenv from "dotenv"
import * as Mocks from './mocks.js';
import * as UserMocks from '../../user-service/__tests__/mocks.js';
import { PointTransaction } from '../models.js';
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

const BASE_PATH = "/point-transactions"

describe("GET /point-transactions", ()=>{
  let numberOfUsers, users
  let numberOfTransactions, transactions
  let adminUser, jwt

  beforeAll(async()=>{
    //Remove any existing records
    await mongoose.connection.db.dropDatabase()

    //Insert users and transactions into database
    numberOfUsers = 2
    numberOfTransactions = 500
    users = UserMocks.generateDBUsers({numberOfUsers})
    transactions = Mocks.generateDBTransactions(numberOfTransactions, {users})
    await User.insertMany(users)
    await PointTransaction.insertMany(transactions)

    //Set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  }, 20_000)

  test("no query params - should return the first 20 sorted transactions, sorted by date in descending order", async ()=>{
    //Send api request
    const endpoint = BASE_PATH
    const response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //Expected transactions ids 
    const defaultPerPage = 20
    const expectedTransactionsIds = [...transactions]
    .sort((a, b)=>b.date - a.date)
    .slice(0, defaultPerPage)
    .map((transaction)=>transaction._id)

    //Actual transaction ids
    const actualTransactionsIds = response.body.data
    .map((transaction)=>transaction._id)

    expect(actualTransactionsIds).toEqual(expectedTransactionsIds)
  })

  test("all query params passed - should return the transactions based on the passed params", async ()=>{
    //Query params
    const filter = {
      userId: users[0]._id,
      type: "award",
      year: 2024, 
      month: 1
    }
    const sort = {field: "date", order: 1}
    const pagination = {page: 1, perPage: 5}
    //Expected transactions ids 
    const expectedTransactionsIds = [...transactions]
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

    //Actual transaction ids
    const actualTransactionsIds = (await PointTransaction.getTransactions(filter, sort, pagination))
    .map((transaction)=>transaction._id.toString())
    expect(actualTransactionsIds).toEqual(expectedTransactionsIds)
  })

})

describe("POST /point-transactions", ()=>{
  let adminUser, currentRecipient, currentRedeemedBy, currentSender
  let awardTransaction, redeemTransaction, transferTransaction
  let endpoint, jwt, response
  
  beforeAll(async()=>{
    currentRecipient = UserMocks.generateDBUser()
    currentSender = UserMocks.generateDBUser()
    currentRedeemedBy = UserMocks.generateDBUser()

    awardTransaction = Mocks.generateInputAwardTransaction(currentRecipient)
    redeemTransaction = Mocks.generateInputRedeemTransaction(currentRedeemedBy)
    transferTransaction = Mocks.generateInputTransferTransaction(currentRecipient, currentSender)
  })

  describe("Award Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRecipient)

      //Send api request
      endpoint = BASE_PATH
      adminUser = UserMocks.generateDBUser({userType: "admin"})
      const {_id: userId, fullName, isAdmin} = adminUser
      jwt = createJWT(userId, fullName, isAdmin)
      response = await request(app).post(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
      .send(awardTransaction)
    })

    test("a new transaction is inserted to database", async ()=>{
      const insertedTransaction = await PointTransaction.findOne()
      expect(insertedTransaction).not.toBe(null)
    })

    test("user.points is updated", async ()=>{
      const updatedRecipient = await User.findById(currentRecipient._id)
      expect(updatedRecipient.points).toEqual(currentRecipient.points + awardTransaction.points)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

  describe("Redeem Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRedeemedBy)

      //Send api request
      endpoint = BASE_PATH
      adminUser = UserMocks.generateDBUser({userType: "admin"})
      const {_id: userId, fullName, isAdmin} = adminUser
      jwt = createJWT(userId, fullName, isAdmin)
      response = await request(app).post(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
      .send(redeemTransaction)
    })

    test("a new transaction is inserted to database", async ()=>{
      const insertedTransaction = await PointTransaction.findOne()
      expect(insertedTransaction).not.toBe(null)
    })

    test("user.points is updated", async ()=>{
      const updatedRedeemedBy = await User.findById(currentRedeemedBy._id)
      expect(updatedRedeemedBy.points).toEqual(currentRedeemedBy.points - redeemTransaction.points)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

  describe("Transfer Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.insertMany([currentRecipient, currentSender])

      //Send api request
      endpoint = BASE_PATH
      adminUser = UserMocks.generateDBUser({userType: "admin"})
      const {_id: userId, fullName, isAdmin} = adminUser
      jwt = createJWT(userId, fullName, isAdmin)
      response = await request(app).post(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
      .send(transferTransaction)
    })

    test("a new transaction is inserted to database", async ()=>{
      const insertedTransaction = await PointTransaction.findOne()
      expect(insertedTransaction).not.toBe(null)
    })

    test("sender.points is updated", async ()=>{
      const updatedSender = await User.findById(currentSender._id)
      expect(updatedSender.points).toEqual(currentSender.points - transferTransaction.points)
    })

    test("recipient.points is updated", async ()=>{
      const updatedRecipient = await User.findById(currentRecipient._id)
      expect(updatedRecipient.points).toEqual(currentRecipient.points + transferTransaction.points)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

})

describe("PUT /point-transactions/:id", ()=>{
  let currentRecipient, currentRedeemedBy, currentSender
  let awardTransaction, redeemTransaction, transactionUpdate, transferTransaction
  let adminUser, endpoint, jwt, response
  
  beforeAll(async()=>{
    currentRecipient = UserMocks.generateDBUser()
    currentSender = UserMocks.generateDBUser()
    currentRedeemedBy = UserMocks.generateDBUser()

    awardTransaction = Mocks.generateDBAwardTransaction(currentRecipient)
    redeemTransaction = Mocks.generateDBRedeemTransaction(currentRedeemedBy)
    transferTransaction = Mocks.generateDBTransferTransaction(currentRecipient, currentSender)
    transactionUpdate = Mocks.generateTransactionUpdate()

    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
  })

  describe("Award Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRecipient)
      await PointTransaction.create(awardTransaction)

      //Send api request
      endpoint = `${BASE_PATH  }/${  awardTransaction._id}`
      response = await request(app).put(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
      .send(transactionUpdate)
    })

    test("the transaction is updated", async ()=>{
      const updatedTransaction = await PointTransaction.findOne()
      expect(updatedTransaction.points).toEqual(transactionUpdate.newPoints)
    })

    test("user.points is updated", async ()=>{
      const updatedRecipient = await User.findById(currentRecipient._id)
      expect(updatedRecipient.points).toEqual(currentRecipient.points - awardTransaction.points + transactionUpdate.newPoints)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

  describe("Redeem Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await PointTransaction.create(redeemTransaction)
      await User.create(currentRedeemedBy)

      //Send api request
      endpoint = `${BASE_PATH  }/${  redeemTransaction._id}`
      response = await request(app).put(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
      .send(transactionUpdate)
    })

    test("the transaction is updated", async ()=>{
      const updatedTransaction = await PointTransaction.findOne()
      expect(updatedTransaction.points).toEqual(transactionUpdate.newPoints)
    })

    test("user.points is updated", async ()=>{
      const updatedRedeemedBy = await User.findById(currentRedeemedBy._id)
      expect(updatedRedeemedBy.points).toEqual(currentRedeemedBy.points + redeemTransaction.points - transactionUpdate.newPoints)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

  describe("Transfer Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.insertMany([currentRecipient, currentSender])
      await PointTransaction.create(transferTransaction)

      //Send api request
      endpoint = `${BASE_PATH  }/${  transferTransaction._id}`
      response = await request(app).put(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
      .send(transactionUpdate)
    })

    test("the transaction is updated", async ()=>{
      const updatedTransaction = await PointTransaction.findOne()
      expect(updatedTransaction.points).toEqual(transactionUpdate.newPoints)
    })

    test("sender.points is updated", async ()=>{
      const updatedSender = await User.findById(currentSender._id)
      expect(updatedSender.points).toEqual(currentSender.points + transferTransaction.points - transactionUpdate.newPoints)
    })

    test("recipient.points is updated", async ()=>{
      const updatedRecipient = await User.findById(currentRecipient._id)
      expect(updatedRecipient.points).toEqual(currentRecipient.points - transferTransaction.points + transactionUpdate.newPoints)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

})

describe("DELETE /point-transactions/:id", ()=>{
  let currentRecipient, currentRedeemedBy, currentSender
  let awardTransaction, redeemTransaction, transactionUpdate, transferTransaction
  let adminUser, endpoint, jwt, response
  
  beforeAll(async()=>{
    currentRecipient = UserMocks.generateDBUser()
    currentSender = UserMocks.generateDBUser()
    currentRedeemedBy = UserMocks.generateDBUser()

    awardTransaction = Mocks.generateDBAwardTransaction(currentRecipient)
    redeemTransaction = Mocks.generateDBRedeemTransaction(currentRedeemedBy)
    transferTransaction = Mocks.generateDBTransferTransaction(currentRecipient, currentSender)
    transactionUpdate = Mocks.generateTransactionUpdate()

    adminUser = UserMocks.generateDBUser({userType: "admin"})
    const {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)
  })

  describe("Award Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRecipient)
      await PointTransaction.create(awardTransaction)

      //Send api request
      endpoint = `${BASE_PATH  }/${  awardTransaction._id}`
      response = await request(app).delete(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
    })

    test("the transaction is deleted", async ()=>{
      const deletedTransaction = await PointTransaction.findOne()
      expect(deletedTransaction).toBe(null)
    })

    test("user.points is updated", async ()=>{
      const updatedRecipient = await User.findById(currentRecipient._id)
      expect(updatedRecipient.points).toEqual(currentRecipient.points - awardTransaction.points)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

  describe("Redeem Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await PointTransaction.create(redeemTransaction)
      await User.create(currentRedeemedBy)

      //Send api request
      endpoint = `${BASE_PATH  }/${  redeemTransaction._id}`
      response = await request(app).delete(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
    })

    test("the transaction is deleted", async ()=>{
      const deletedTransaction = await PointTransaction.findOne()
      expect(deletedTransaction).toBe(null)
    })

    test("user.points is updated", async ()=>{
      const updatedRedeemedBy = await User.findById(currentRedeemedBy._id)
      expect(updatedRedeemedBy.points).toEqual(currentRedeemedBy.points + redeemTransaction.points)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

  describe("Transfer Transaction", ()=>{
    beforeAll(async ()=>{
      //Remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.insertMany([currentRecipient, currentSender])
      await PointTransaction.create(transferTransaction)

      //Send api request
      endpoint = `${BASE_PATH  }/${  transferTransaction._id}`
      response = await request(app).delete(endpoint)
      .set("Cookie", cookie.serialize("jwt", jwt))
    })

    test("the transaction is deleted", async ()=>{
      const deletedTransaction = await PointTransaction.findOne()
      expect(deletedTransaction).toBe(null)
    })

    test("sender.points is updated", async ()=>{
      const updatedSender = await User.findById(currentSender._id)
      expect(updatedSender.points).toEqual(currentSender.points + transferTransaction.points)
    })

    test("recipient.points is updated", async ()=>{
      const updatedRecipient = await User.findById(currentRecipient._id)
      expect(updatedRecipient.points).toEqual(currentRecipient.points - transferTransaction.points)
    })

    test("response.ok is true and error is null", async ()=>{
      expect(response.body.error).toBe(null)
      expect(response.ok).toBe(true)
    })

  })

})