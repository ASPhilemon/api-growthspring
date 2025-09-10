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
    getCashLocations: jest.fn(),
    getCashLocationById: jest.fn(),
    updateCashLocation: jest.fn(),
    recordTransfer: jest.fn(),
    updateTransfer: jest.fn(),
    deleteTransfer: jest.fn(),
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

const BASE_PATH = "/cash-locations"

const regularUser = UserMocks.generateDBUser()
const adminUser = UserMocks.generateDBUser({userType: "admin"})
const transfer = Mocks.generateTransfer()
const transferUpdate = Mocks.generateTransferUpdate()
const cashLocationUpdate = Mocks.generateCashLocationUpdate()


const routes = [
  {
    path: "/", method: "get",
    allowed: ["admin",],
    serviceHandler: ServiceManager.getCashLocations,
    serviceHandlerArgs: []
  }, 
  {
    path: "/cash-location-123", method: "get", 
    allowed : ["admin"],
    serviceHandler: ServiceManager.getCashLocationById,
    serviceHandlerArgs: ["cash-location-123"],
  },
  {
    path: "/cash-location-123", method: "put", 
    body: cashLocationUpdate,
    allowed : ["admin"],
    serviceHandler: ServiceManager.updateCashLocation,
    serviceHandlerArgs: ["cash-location-123", cashLocationUpdate]
  },
  {
    path: "/transfers", method: "post",
    body: transfer,
    allowed : ["admin"],
    serviceHandler: ServiceManager.recordTransfer,
    serviceHandlerArgs: [transfer]
  },
  {
    path: "/transfers/transfer-123", method: "put", 
    body: transferUpdate,
    allowed : ["admin"],
    serviceHandler: ServiceManager.updateTransfer,
    serviceHandlerArgs: ["transfer-123", transferUpdate]
  },
  {
    path: "/transfers/transfer-123", method: "delete", 
    body: {},
    allowed : ["admin"],
    serviceHandler: ServiceManager.deleteTransfer,
    serviceHandlerArgs: ["transfer-123"]
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