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
    getWithdraws: jest.fn(),
    getWithdrawById: jest.fn(),
    getYearlyWithdraws: jest.fn(),
    recordWithdraw: jest.fn(),
    updateWithdraw: jest.fn(),
    deleteWithdraw: jest.fn(),
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

const BASE_PATH = "/withdraws"

const regularUser = UserMocks.generateDBUser()
const adminUser = UserMocks.generateDBUser({userType: "admin"})
const withdraw = Mocks.generateInputWithdraw()
const withdrawUpdate = Mocks.generateWithdrawUpdate()

const withdrawsQuery = {
  userId: 'user-123', year: 2024,
  month: 1, sortBy: 'amount',
  sortOrder: 1, page: 1, perPage: 20
}

const {userId, year, month, sortBy, sortOrder, page, perPage} = withdrawsQuery

const routes = [
  {
    path: "/", method: "get",
    query: withdrawsQuery,
    allowed: ["admin",],
    serviceHandler: ServiceManager.getWithdraws,
    serviceHandlerArgs: [
      { userId, year, month},
      {field: sortBy, order: sortOrder}, 
      {page, perPage}
    ]
  }, 
  {
    path: "/withdraw-123", method: "get", 
    allowed : ["admin"],
    serviceHandler: ServiceManager.getWithdrawById,
    serviceHandlerArgs: ["withdraw-123"],
  },
  {
    path: "/", method: "post",
    body:withdraw,
    allowed : ["admin"],
    serviceHandler: ServiceManager.recordWithdraw,
    serviceHandlerArgs: [{...withdraw, recordedBy: {_id: adminUser._id, fullName: adminUser.fullName}}]
  },
  {
    path: "/withdraw-123", method: "put", 
    body: withdrawUpdate,
    allowed : ["admin"],
    serviceHandler: ServiceManager.updateWithdraw,
    serviceHandlerArgs: ["withdraw-123", withdrawUpdate]
  },
  {
    path: "/withdraw-123", method: "delete", 
    body: {cashLocationToAddId: "cash-location-123"},
    allowed : ["admin"],
    serviceHandler: ServiceManager.deleteWithdraw,
    serviceHandlerArgs: ["withdraw-123", "cash-location-123"]
  }
]

describe("Access Control", ()=>{
  for (let route of routes){
    const endpoint = BASE_PATH + route.path
    const anonymousUserAllowed = route.allowed.includes("anonymous")
    const regularUserAllowed = route.allowed.includes("regular-user")

    test(`${route.method + " " + route.path}: anonymous user is ${anonymousUserAllowed? "allowed" : "denied"} access `, async () => {
      const response = await request(app)[route.method](endpoint)
      if (anonymousUserAllowed){
        expect(route.serviceHandler).toHaveBeenCalled();
      }
      else{
        expect(route.serviceHandler).not.toHaveBeenCalled();
        expect(response.statusCode).toBe(401)
      }
    });

    test(`${route.method + " " + route.path}: regular user is ${regularUserAllowed? "allowed" : "denied"} access  `, async () => {
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

    test(`${route.method + " " + route.path}: admin user is allowed access`, async () => {
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