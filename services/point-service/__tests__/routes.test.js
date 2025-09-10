import { jest } from '@jest/globals';
import request from "supertest";
import cookie from "cookie";
import dotenv from "dotenv"
import * as Mocks from "./mocks.js"
import * as UserMocks from "../../user-service/__tests__/mocks.js"

//load environment variables
dotenv.config()

// mock dependencies
jest.unstable_mockModule('../service.js', () => {
  return {
    getTransactions: jest.fn(),
    getTransactionById: jest.fn(),
    getTransactionByRefId: jest.fn(),
    recordTransaction: jest.fn(),
    awardPoints: jest.fn(),
    redeemPoints: jest.fn(),
    transferPoints: jest.fn(),
    findByIdAndUpdatePoints: jest.fn(),
    findByRefIdAndUpdatePoints: jest.fn(),
    deleteTransactionById: jest.fn(),
    deleteTransactionByRefId: jest.fn()
  }
})

//import test app
const app = (await import("../../../app.js")).default;

// import dependencies
const ServiceManager = await import("../service.js");

import { createJWT } from '../../auth-service/service.js';

beforeEach(() => {
  jest.clearAllMocks();
});

const BASE_PATH = "/point-transactions"

const regularUser = UserMocks.generateDBUser()
const adminUser = UserMocks.generateDBUser({userType: "admin"})
const transaction = Mocks.generateInputAwardTransaction()
const transactionUpdate = Mocks.generateTransactionUpdate()

const transactionQuery = {
  userId: 'user-123', year: 2024,
  month: 1, sortBy: 'amount',
  sortOrder: 1, page: 1, perPage: 20,
  type: "award"
}

const {userId, type, year, month, sortBy, sortOrder, page, perPage} = transactionQuery

const routes = [
  {
    path: "/", method: "get",
    query: transactionQuery,
    allowed: ["admin",],
    serviceHandler: ServiceManager.getTransactions,
    serviceHandlerArgs: [
      { userId, year, month, type},
      {field: sortBy, order: sortOrder}, 
      {page, perPage}
    ]
  }, 
  {
    path: "/transaction-123", method: "get", 
    allowed : ["admin"],
    serviceHandler: ServiceManager.getTransactionById,
    serviceHandlerArgs: ["transaction-123"],
  },
  {
    path: "/", method: "post",
    body:transaction,
    allowed : ["admin"],
    serviceHandler: ServiceManager.recordTransaction,
    serviceHandlerArgs: [transaction]
  },
  {
    path: "/transaction-123", method: "put", 
    body: transactionUpdate,
    allowed : ["admin"],
    serviceHandler: ServiceManager.findByIdAndUpdatePoints,
    serviceHandlerArgs: ["transaction-123", transactionUpdate.newPoints]
  },
  {
    path: "/transaction-123", method: "delete", 
    allowed : ["admin"],
    serviceHandler: ServiceManager.deleteTransactionById,
    serviceHandlerArgs: ["transaction-123"]
  }
]

describe("Access Control", ()=>{
  for (let route of routes){
    const endpoint = BASE_PATH + route.path
    const anonymousUserAllowed = route.allowed.includes("anonymous")
    const regularUserAllowed = route.allowed.includes("regular-user")
    test(`${route.path + " " + route.method}: anonymous user is ${anonymousUserAllowed? "allowed": "denied"} access`, async () => {
      const response = await request(app)[route.method](endpoint)
      if (anonymousUserAllowed){
        expect(route.serviceHandler).toHaveBeenCalled();
      }
      else{
        expect(route.serviceHandler).not.toHaveBeenCalled();
        expect(response.statusCode).toBe(401)
      }
    });

    test(`${route.path + " " + route.method}: regular user is ${regularUserAllowed? "allowed": "denied"} access`, async () => {
      const {_id, fullName, isAdmin} = regularUser
      const jwt = createJWT(_id, fullName, isAdmin)
      const response = await request(app)[route.method](endpoint)
        .set("Cookie", cookie.serialize("jwt", jwt))
      if (regularUserAllowed){
        expect(route.serviceHandler).toHaveBeenCalled();
      }
      else{
        expect(route.serviceHandler).not.toHaveBeenCalled();
        expect(response.statusCode).toBe(403)
      }
    });

    test(`${route.path + " " + route.method}: admin user is allowed access`, async () => {
      const {_id, fullName, isAdmin} = adminUser
      const jwt = createJWT(_id, fullName, isAdmin)
      await request(app)[route.method](endpoint)
        .set("Cookie", cookie.serialize("jwt", jwt))
      expect(route.serviceHandler).toHaveBeenCalled()
    });

  }
})

describe("Service Handlers Are Called With Correct Args", ()=>{
  for (let route of routes){

    const queryString = new URLSearchParams(route.query).toString();
    const endpoint = BASE_PATH + route.path + (queryString ? `?${queryString}` : "");

    test(`${route.method + " " + route.path} service handler is called with correct args`, async () => {
      const {_id, fullName, isAdmin} = adminUser
      const jwt = createJWT(_id, fullName, isAdmin)
      await request(app)[route.method](endpoint)
        .set("Cookie", cookie.serialize("jwt", jwt))
        .send(route.body)
      expect(route.serviceHandler).toHaveBeenCalledWith(...route.serviceHandlerArgs)
    });

  }
})