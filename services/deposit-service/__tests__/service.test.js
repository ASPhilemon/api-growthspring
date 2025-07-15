import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import * as Errors from '../../../utils/error-util.js';
import * as Mocks from "./mocks.js"

// mock dependencies
let DateUtil = await import('../../../utils/date-util.js')
jest.unstable_mockModule('../../../utils/date-util.js', async () => {
  return {
    ...DateUtil,
    getToday: jest.fn(()=>new Date("2025-06-01"))
  }
})

DateUtil = await import('../../../utils/date-util.js')

jest.unstable_mockModule('../models.js', () => {
  return {
    Deposit: {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      getDeposits: jest.fn()
    },
    YearlyDeposit: {
      find: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(()=>({matchedCount: 1})),
      bulkWrite: jest.fn()
    }
  }
})

jest.unstable_mockModule('../../../services/user-service/service.js', () => {
  return {
    getUserById: jest.fn(),
    updatePermanentInvestment: jest.fn(),
    updateTemporaryInvestment: jest.fn(),
  }
})

jest.unstable_mockModule('../../../services/cash-location-service/service.js', () => {
  return {
    addToCashLocation: jest.fn(),
  }
})

jest.unstable_mockModule('../../../services/point-service/service.js', () => {
  return {
    awardPoints: jest.fn(),
    findByRefIdAndUpdatePoints: jest.fn(),
    deleteTransactionByRefId: jest.fn()
  }
})

jest.unstable_mockModule('../../../services/email-service/service.js', () => {
  return {
    sendEmail: jest.fn(),
  }
})

jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async (callback) => {
  return callback();
});

//import test module
const ServiceManager = await import("../service.js");

// import dependencies
const {Deposit, YearlyDeposit} = await import("../models.js")
const UserServiceManager = await import('../../../services/user-service/service.js')
const CashLocationServiceManager = await import('../../../services/cash-location-service/service.js')
const PointServiceManager = await import('../../../services/point-service/service.js')
const EmailServiceManager = await import('../../../services/email-service/service.js')

//tests

beforeEach(() => {
  jest.clearAllMocks();
});

const  ObjectId = mongoose.Types.ObjectId

describe("getDeposits", ()=>{
  let userId, fakeDeposits

  beforeEach(()=>{
    userId = new ObjectId().toString()
    fakeDeposits = [
      Mocks.createDBDeposit("Permanent"),
      Mocks.createDBDeposit("Temporary"),
    ]
    Deposit.getDeposits.mockResolvedValue(fakeDeposits)
  })
  
  test("Deposit.getDeposits is called with correct args", async ()=>{
    await ServiceManager.getDeposits({userId}, {field: "amount"}, {page: 1})
    expect(Deposit.getDeposits).toHaveBeenCalledWith({userId}, {field: "amount"}, {page: 1})
  })
  test("returns result of Deposit.getDeposits", async ()=>{
    const result = await ServiceManager.getDeposits()
    expect(result).toEqual(fakeDeposits)
  })
})

describe("getDepositById", ()=>{
  let fakeDeposit
  beforeEach(()=>{
    fakeDeposit = Mocks.createDBDeposit()
    Deposit.findById.mockResolvedValue(fakeDeposit)
  })
  
  test("Deposit.findById is called with correct args", async ()=>{
    ServiceManager.getDepositById(fakeDeposit._id)
    expect(Deposit.findById).toHaveBeenCalledWith(fakeDeposit._id)
  })
  test("returns result of Deposit.findById", async ()=>{
    const result = await ServiceManager.getDepositById(fakeDeposit._id)
    expect(result).toEqual(fakeDeposit)
  })
  test("throws NotFoundError if deposit is not found", async ()=>{
    Deposit.findById.mockResolvedValue(null)
    expect(()=>ServiceManager.getDepositById(fakeDeposit._id)).rejects.toThrow(Errors.NotFoundError)
  })
})

describe("getYearlyDeposits", ()=>{
  let fakeYearlyDeposits
  beforeEach(()=>{
    fakeYearlyDeposits = []
    YearlyDeposit.find.mockResolvedValue(fakeYearlyDeposits)
  })

  test("YearlyDeposit.find is called with correct args", async ()=>{
    await ServiceManager.getYearlyDeposits()
    expect(YearlyDeposit.find).toHaveBeenCalledWith()
  })

  test("returns result of YearlyDeposit.find", async ()=>{
    const result = await ServiceManager.getYearlyDeposits()
    expect(result).toEqual(fakeYearlyDeposits)
  })
})

describe("recordDeposit:Permanent", ()=>{
  let fakeUser, fakeAdminUser, newDeposit

  beforeEach(async ()=>{
    fakeUser = Mocks.createDBUser("regular")
    fakeAdminUser = Mocks.createDBUser("admin")
    newDeposit = Mocks.createInputDeposit(fakeUser, "Permanent")
    const {_id, fullName} = fakeAdminUser
    newDeposit.recordedBy = {_id,  fullName}
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    await ServiceManager.recordDeposit(newDeposit)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(newDeposit.cashLocation._id, newDeposit.amount )
  })

  test("Deposit.create is called with correct args", ()=>{
    expect(Deposit.create).toHaveBeenCalledWith({...newDeposit, balanceBefore: fakeUser.permanentInvestment.amount})
  })

  test("UserServiceManager.updatePermanentInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(fakeUser.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(newDeposit.date, DateUtil.getToday())
    const deltaUnits = fakeUser.permanentInvestment.amount * daysInvestment + newDeposit.amount * daysDeposit
    expect(UserServiceManager.updatePermanentInvestment)
    .toHaveBeenCalledWith(fakeUser._id, {
      deltaAmount: newDeposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.updateOne is called with correct args", ()=>{
    const args = YearlyDeposit.updateOne.mock.calls[0]
    expect(args[0]).toEqual({year: new Date(newDeposit.date).getFullYear()})
    expect(args[1].$inc).toEqual({
      total: newDeposit.amount,
      [`monthTotals.${new Date(newDeposit.date).getMonth()}`]: newDeposit.amount 
    })
  })

  test("PointServiceManager.awardPoints is called with correct args", ()=>{
    const pointsAwarded = Math.floor((newDeposit.amount / 10000) * 3)
    expect(PointServiceManager.awardPoints)
    .toHaveBeenCalledWith(fakeUser._id, pointsAwarded, "Deposit", newDeposit._id )
  })

  test("EmailServiceManager.sendEmail is called with correct args", ()=>{
    const args = EmailServiceManager.sendEmail.mock.calls[0]
    expect(args[1]).toBe(fakeUser.email)
    expect(args[2]).toBe("Deposit Recorded")
    const contextStrings = ["Jane Doe", "UGX 10,000", "March 1, 2025", "Permanent", "3 points", "UGX 2,010,000"]
    const message = args[3]
    expect(contextStrings.every((contextString => message.includes(contextString)))).toBe(true)
  })
  
})

describe("recordDeposit:Temporary", ()=>{
  let fakeUser, fakeAdminUser, newDeposit

  beforeEach(async ()=>{
    fakeUser = Mocks.createDBUser("regular")
    fakeAdminUser = Mocks.createDBUser("admin")
    newDeposit = Mocks.createInputDeposit(fakeUser, "Temporary")
    const {_id, fullName} = fakeAdminUser
    newDeposit.recordedBy = {_id,  fullName}
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    await ServiceManager.recordDeposit(newDeposit)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(newDeposit.cashLocation._id, newDeposit.amount )
  })


  test("Deposit.create is called with correct args", ()=>{
    expect(Deposit.create).toHaveBeenCalledWith({...newDeposit, balanceBefore: fakeUser.temporaryInvestment.amount})
  })

  test("UserServiceManager.updateTemporaryInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(fakeUser.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(newDeposit.date, DateUtil.getToday())
    const deltaUnits = fakeUser.temporaryInvestment.amount * daysInvestment + newDeposit.amount * daysDeposit
    expect(UserServiceManager.updateTemporaryInvestment)
    .toHaveBeenCalledWith(fakeUser._id, {
      deltaAmount: newDeposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.updateOne is not called", ()=>{
    expect(YearlyDeposit.updateOne).not.toHaveBeenCalled()
  })

  test("PointServiceManager.awardPoints is not called", ()=>{
    expect(PointServiceManager.awardPoints).not.toHaveBeenCalled()
  })

})

describe("updateDeposit:Permanent", ()=>{
  let fakeUser, fakeAdminUser, fakeDeposit, depositUpdate

  beforeEach(async ()=>{
    fakeUser = Mocks.createDBUser("regular")
    fakeAdminUser = Mocks.createDBUser("admin")
    fakeDeposit = Mocks.createDBDeposit(fakeUser, "Permanent", fakeAdminUser)
    depositUpdate = Mocks.createDepositUpdate(fakeDeposit)
    depositUpdate.updatedById = fakeAdminUser._id
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    Deposit.findById.mockResolvedValue(fakeDeposit)
    await ServiceManager.updateDeposit(fakeDeposit._id, depositUpdate)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledTimes(2)
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToAdd._id, depositUpdate.amount )
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToDeduct._id, fakeDeposit.amount )
  })

  test("Deposit.updateOne is called with correct args", ()=>{
    expect(Deposit.updateOne).toHaveBeenCalledWith({_id: fakeDeposit._id}, {
      amount: depositUpdate.amount,
      date: depositUpdate.date,
      cashLocation: depositUpdate.cashLocationToAdd
    })
  })

  test("UserServiceManager.updatePermanentInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(fakeUser.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysCurrentDeposit = DateUtil.getDaysDifference(fakeDeposit.date, DateUtil.getToday())
    const daysUpdatedDeposit = DateUtil.getDaysDifference(depositUpdate.date, DateUtil.getToday())
    const deltaUnits = fakeUser.permanentInvestment.amount * daysInvestment
    + depositUpdate.amount * daysUpdatedDeposit
    - fakeDeposit.amount * daysCurrentDeposit
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    const deltaAmount = depositUpdate.amount - fakeDeposit.amount
    
    expect(UserServiceManager.updatePermanentInvestment)
    .toHaveBeenCalledWith(fakeUser._id, {
      deltaAmount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.bulkWrite is called with correct args", ()=>{
    const depositUpdateDate = new Date(depositUpdate.date)
    const currentDepositDate = new Date(fakeDeposit.date)
    const args = YearlyDeposit.bulkWrite.mock.calls[0]
    expect(args[0]).toEqual([
      {
        updateOne: {
          filter: { year: depositUpdateDate.getFullYear()},
          update: {
            $inc: {
              total: depositUpdate.amount,
              [`monthTotals.${depositUpdateDate.getMonth()}`]: depositUpdate.amount
            },
          }
        }
      },

      {
        updateOne: {
          filter: { year: currentDepositDate.getFullYear()},
          update: {
            $inc: {
              total: - fakeDeposit.amount,
              [`monthTotals.${currentDepositDate.getMonth()}`]: - fakeDeposit.amount
            },
          }
        }
      }
    ])

  })

  test("PointServiceManager.findByRefIdAndUpdatePoints is called with correct args", ()=>{
    const pointsAwarded = Math.floor((depositUpdate.amount / 10000) * 3)
    expect(PointServiceManager.findByRefIdAndUpdatePoints)
    .toHaveBeenCalledWith(fakeDeposit._id, pointsAwarded)
  })

  test("EmailServiceManager.sendEmail is called with correct args", ()=>{
    const currentPointsAwarded = Math.floor((fakeDeposit.amount / 10000) * 3)
    const newPointsAwarded = Math.floor((depositUpdate.amount / 10000) * 3)
    const args = EmailServiceManager.sendEmail.mock.calls[0]
    expect(args[1]).toBe(fakeUser.email)
    expect(args[2]).toBe("Deposit Updated")
    const contextStrings = [
      fakeUser.fullName, `UGX ${fakeDeposit.amount.toLocaleString()}`, `${currentPointsAwarded} points`,
      `UGX ${depositUpdate.amount.toLocaleString()}`, `${newPointsAwarded} points`, fakeDeposit.type
    ]
    const message = args[3]
    expect(contextStrings.every((contextString => message.includes(contextString)))).toBe(true)
  })
  
})

describe("updateDeposit:Temporary", ()=>{
  let fakeUser, fakeAdminUser, fakeDeposit, depositUpdate

  beforeEach(async ()=>{
    fakeUser = Mocks.createDBUser("regular")
    fakeAdminUser = Mocks.createDBUser("admin")
    fakeDeposit = Mocks.createDBDeposit(fakeUser, "Temporary", fakeAdminUser)
    depositUpdate = Mocks.createDepositUpdate(fakeDeposit)
    depositUpdate.updatedById = fakeAdminUser._id
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    Deposit.findById.mockResolvedValue(fakeDeposit)
    await ServiceManager.updateDeposit(fakeDeposit._id, depositUpdate)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledTimes(2)
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToAdd._id, depositUpdate.amount )
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToDeduct._id, fakeDeposit.amount )
  })

  test("Deposit.updateOne is called with correct args", ()=>{
    expect(Deposit.updateOne).toHaveBeenCalledWith({_id: fakeDeposit._id}, {
      amount: depositUpdate.amount,
      date: depositUpdate.date,
      cashLocation: depositUpdate.cashLocationToAdd
    })
  })

  test("UserServiceManager.updateTemporaryInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(fakeUser.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysCurrentDeposit = DateUtil.getDaysDifference(fakeDeposit.date, DateUtil.getToday())
    const daysUpdatedDeposit = DateUtil.getDaysDifference(depositUpdate.date, DateUtil.getToday())
    const deltaUnits = fakeUser.temporaryInvestment.amount * daysInvestment
    + depositUpdate.amount * daysUpdatedDeposit
    - fakeDeposit.amount * daysCurrentDeposit
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    const deltaAmount = depositUpdate.amount - fakeDeposit.amount
    
    expect(UserServiceManager.updateTemporaryInvestment)
    .toHaveBeenCalledWith(fakeUser._id, {
      deltaAmount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.bulkWrite is not called", ()=>{
    expect(YearlyDeposit.bulkWrite).not.toHaveBeenCalled()

  })

  test("PointServiceManager.findByRefIdAndUpdatePoints is not called", ()=>{
    expect(PointServiceManager.findByRefIdAndUpdatePoints).not.toHaveBeenCalled()
  })
  
})

describe("deleteDeposit:Permanent", ()=>{
  let fakeUser, fakeDeposit, cashLocationToDeductId
  
  beforeEach(async ()=>{
    fakeUser = Mocks.createDBUser("regular")
    fakeDeposit = Mocks.createDBDeposit(fakeUser, "Permanent")
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    Deposit.findById.mockResolvedValue(fakeDeposit)
    cashLocationToDeductId = new ObjectId().toString()
    await ServiceManager.deleteDeposit(fakeDeposit._id, cashLocationToDeductId)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(cashLocationToDeductId, -fakeDeposit.amount )
  })

  test("Deposit.deleteOne is called with correct args", ()=>{
    expect(Deposit.deleteOne).toHaveBeenCalledWith({_id: fakeDeposit._id})
  })

  test("UserServiceManager.updatePermanentInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(fakeUser.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(fakeDeposit.date, DateUtil.getToday())
    const deltaUnits = fakeUser.permanentInvestment.amount * daysInvestment - fakeDeposit.amount * daysDeposit
    expect(UserServiceManager.updatePermanentInvestment)
    .toHaveBeenCalledWith(fakeUser._id, {
      deltaAmount: -fakeDeposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.updateOne is called with correct args", ()=>{
    const args = YearlyDeposit.updateOne.mock.calls[0]
    expect(args[0]).toEqual({year: new Date(fakeDeposit.date).getFullYear()})
    expect(args[1].$inc).toEqual({
      total: - fakeDeposit.amount,
      [`monthTotals.${new Date(fakeDeposit.date).getMonth()}`]:  - fakeDeposit.amount
    })
  })

  test("PointServiceManager.deleteTransactionByRefId is called with correct args", ()=>{
    expect(PointServiceManager.deleteTransactionByRefId)
    .toHaveBeenCalledWith(fakeDeposit._id)
  })

  test("EmailServiceManager.sendEmail is called with correct args", ()=>{
    const args = EmailServiceManager.sendEmail.mock.calls[0]
    expect(args[1]).toBe(fakeUser.email)
    expect(args[2]).toBe("Deposit Deleted")
    const contextStrings = [fakeDeposit.depositor.fullName, `${fakeDeposit.amount.toLocaleString()}`, "March 1, 2025", "Permanent",]
    const message = args[3]
    expect(contextStrings.every((contextString => message.includes(contextString)))).toBe(true)
  })
  
})

describe("deleteDeposit:Temporary", ()=>{
  let fakeUser, fakeDeposit, cashLocationToDeductId
  
  beforeEach(async ()=>{
    fakeUser = Mocks.createDBUser("regular")
    fakeDeposit = Mocks.createDBDeposit(fakeUser, "Temporary")
    UserServiceManager.getUserById.mockResolvedValue(fakeUser)
    Deposit.findById.mockResolvedValue(fakeDeposit)
    cashLocationToDeductId = new ObjectId().toString()
    await ServiceManager.deleteDeposit(fakeDeposit._id, cashLocationToDeductId)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(cashLocationToDeductId, -fakeDeposit.amount )
  })

  test("Deposit.deleteOne is called with correct args", ()=>{
    expect(Deposit.deleteOne).toHaveBeenCalledWith({_id: fakeDeposit._id})
  })

  test("UserServiceManager.updateTemporaryInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(fakeUser.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(fakeDeposit.date, DateUtil.getToday())
    const deltaUnits = fakeUser.temporaryInvestment.amount * daysInvestment - fakeDeposit.amount * daysDeposit

    expect(UserServiceManager.updateTemporaryInvestment)
    .toHaveBeenCalledWith(fakeUser._id, {
      deltaAmount: -fakeDeposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.updateOne is not called", ()=>{
    expect(YearlyDeposit.updateOne).not.toHaveBeenCalled()
  })

  test("PointServiceManager.deleteTransactionByRefId is not called", ()=>{
    expect(PointServiceManager.deleteTransactionByRefId)
    .not.toHaveBeenCalled()
  })

  test("EmailServiceManager.sendEmail is called with correct args", ()=>{
    const args = EmailServiceManager.sendEmail.mock.calls[0]
    expect(args[1]).toBe(fakeUser.email)
    expect(args[2]).toBe("Deposit Deleted")
    const contextStrings = [fakeDeposit.depositor.fullName, `${fakeDeposit.amount.toLocaleString()}`, "March 1, 2025", fakeDeposit.type,]
    const message = args[3]
    expect(contextStrings.every((contextString => message.includes(contextString)))).toBe(true)
  })
  
})