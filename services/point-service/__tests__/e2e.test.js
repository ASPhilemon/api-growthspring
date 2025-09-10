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

const BASE_PATH = "/point-transactions"

describe("GET /point-transactions", ()=>{
  let users, numberOfUsers
  let transactions, numberOfTransactions
  let adminUser, jwt

  beforeAll(async()=>{
    //remove any existing records
    await mongoose.connection.db.dropDatabase()

    //insert users and transactions into database
    numberOfUsers = 2
    numberOfTransactions = 500
    users = UserMocks.generateDBUsers({numberOfUsers})
    transactions = Mocks.generateDBTransactions(numberOfTransactions, {users})
    await User.insertMany(users)
    await PointTransaction.insertMany(transactions)

    //set jwt
    adminUser = UserMocks.generateDBUser({userType: "admin"})
    let {_id: userId, fullName, isAdmin} = adminUser
    jwt = createJWT(userId, fullName, isAdmin)

  }, 20_000)

  test("no query params - should return the first 20 sorted transactions, sorted by date in descending order", async ()=>{
    //send api request
    let endpoint = BASE_PATH
    let response = await request(app).get(endpoint)
    .set("Cookie", cookie.serialize("jwt", jwt))

    //expected transactions ids 
    let defaultPerPage = 20
    let expectedTransactionsIds = [...transactions]
    .sort((a, b)=>b.date - a.date)
    .slice(0, defaultPerPage)
    .map((transaction)=>transaction._id)

    //actual transaction ids
    let actualTransactionsIds = response.body.data
    .map((transaction)=>transaction._id)

    expect(actualTransactionsIds).toEqual(expectedTransactionsIds)
  })

  test("all query params passed - should return the transactions based on the passed params", async ()=>{
    //query params
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

describe("POST /point-transactions", ()=>{
  let currentRecipient, currentSender, currentRedeemedBy, adminUser
  let awardTransaction, redeemTransaction, transferTransaction
  let jwt, endpoint, response
  
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRecipient)

      //send api request
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRedeemedBy)

      //send api request
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.insertMany([currentRecipient, currentSender])

      //send api request
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
  let currentRecipient, currentSender, currentRedeemedBy
  let awardTransaction, redeemTransaction, transferTransaction, transactionUpdate
  let adminUser, jwt, endpoint, response
  
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRecipient)
      await PointTransaction.create(awardTransaction)

      //send api request
      endpoint = BASE_PATH + "/" + awardTransaction._id
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await PointTransaction.create(redeemTransaction)
      await User.create(currentRedeemedBy)

      //send api request
      endpoint = BASE_PATH + "/" + redeemTransaction._id
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.insertMany([currentRecipient, currentSender])
      await PointTransaction.create(transferTransaction)

      //send api request
      endpoint = BASE_PATH + "/" + transferTransaction._id
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
  let currentRecipient, currentSender, currentRedeemedBy
  let awardTransaction, redeemTransaction, transferTransaction, transactionUpdate
  let adminUser, jwt, endpoint, response
  
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.create(currentRecipient)
      await PointTransaction.create(awardTransaction)

      //send api request
      endpoint = BASE_PATH + "/" + awardTransaction._id
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await PointTransaction.create(redeemTransaction)
      await User.create(currentRedeemedBy)

      //send api request
      endpoint = BASE_PATH + "/" + redeemTransaction._id
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
      //remove any existing records in database
      await mongoose.connection.db.dropDatabase()

      await User.insertMany([currentRecipient, currentSender])
      await PointTransaction.create(transferTransaction)

      //send api request
      endpoint = BASE_PATH + "/" + transferTransaction._id
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