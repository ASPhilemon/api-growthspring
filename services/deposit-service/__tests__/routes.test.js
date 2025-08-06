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
    getDeposits: jest.fn(),
    getDepositById: jest.fn(),
    getYearlyDeposits: jest.fn(),
    recordDeposit: jest.fn(),
    updateDeposit: jest.fn(),
    deleteDeposit: jest.fn(),
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

const BASE_PATH = "/deposits"

const regularUser = UserMocks.generateDBUser()
const adminUser = UserMocks.generateDBUser({userType: "admin"})
const deposit = Mocks.generateInputDeposit()
const depositUpdate = Mocks.generateDepositUpdate()

const depositsQuery = {
  userId: 'user-123', year: 2024,
  month: 1, sortBy: 'amount',
  sortOrder: 1, page: 1, perPage: 20
}

const {userId, year, month, sortBy, sortOrder, page, perPage} = depositsQuery

const routes = [
  {
    path: "/", method: "get",
    query: depositsQuery,
    allowed: ["admin",],
    serviceHandler: ServiceManager.getDeposits,
    serviceHandlerArgs: [
      { userId, year, month},
      {field: sortBy, order: sortOrder}, 
      {page, perPage}
    ]
  }, 
  {
    path: "/deposit-123", method: "get", 
    allowed : ["admin"],
    serviceHandler: ServiceManager.getDepositById,
    serviceHandlerArgs: ["deposit-123"],
  },
  {
    path: "/yearly-deposits", method: "get", 
    allowed : ["admin"],
    serviceHandler: ServiceManager.getYearlyDeposits,
    serviceHandlerArgs: [],
  },
  {
    path: "/", method: "post",
    body:deposit,
    allowed : ["admin"],
    serviceHandler: ServiceManager.recordDeposit,
    serviceHandlerArgs: [{...deposit, recordedBy: {_id: adminUser._id, fullName: adminUser.fullName}}]
  },
  {
    path: "/deposit-123", method: "put", 
    body: depositUpdate,
    allowed : ["admin"],
    serviceHandler: ServiceManager.updateDeposit,
    serviceHandlerArgs: ["deposit-123", {...depositUpdate, updatedById: adminUser._id}]
  },
  {
    path: "/deposit-123", method: "delete", 
    body: {cashLocationToDeductId: "cash-location-123"},
    allowed : ["admin"],
    serviceHandler: ServiceManager.deleteDeposit,
    serviceHandlerArgs: ["deposit-123", "cash-location-123"]
  }
]

describe("Access Control", ()=>{
  for (let route of routes){
    const endpoint = BASE_PATH + route.path
    test("anonymous user", async () => {
      const anonymousUserAllowed = route.allowed.includes("anonymous")
      const response = await request(app)[route.method](endpoint)
      if (anonymousUserAllowed){
        expect(route.serviceHandler).toHaveBeenCalled();
      }
      else{
        expect(route.serviceHandler).not.toHaveBeenCalled();
        expect(response.statusCode).toBe(401)
      }
    });

    test("regular user", async () => {
      const regularUserAllowed = route.allowed.includes("regular-user")
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

    test("admin user is allowed access", async () => {
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