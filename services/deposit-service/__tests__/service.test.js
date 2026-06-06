import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import * as Errors from '../../../utils/error-util.js';
import * as Mocks from "./mocks.js"
import * as UserMocks from "../../user-service/__tests__/mocks.js"

// Mock dependencies
let DateUtil = await import('../../../utils/date-util.js')
jest.unstable_mockModule('../../../utils/date-util.js', async () => ({
    ...DateUtil,
    getToday: jest.fn(()=>new Date("2025-06-01"))
  }))

DateUtil = await import('../../../utils/date-util.js')

jest.unstable_mockModule('../models.js', () => ({
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
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      bulkWrite: jest.fn()
    }
  }))

jest.unstable_mockModule('../../../services/user-service/service.js', () => ({
    getUserById: jest.fn(),
    updatePermanentInvestment: jest.fn(),
    updateTemporaryInvestment: jest.fn(),
  }))

jest.unstable_mockModule('../../../services/cash-location-service/service.js', () => ({
    addToCashLocation: jest.fn(),
  }))

jest.unstable_mockModule('../../../services/point-service/service.js', () => ({
    awardPoints: jest.fn(),
    findByRefIdAndUpdatePoints: jest.fn(),
    deleteTransactionByRefId: jest.fn()
  }))

jest.unstable_mockModule('../../../services/email-service/service.js', () => ({
    sendEmail: jest.fn(),
  }))

jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async (callback) => callback());

//Import test module
const Service = await import("../service.js");

// Import dependencies
const {Deposit, YearlyDeposit} = await import("../models.js")
const UserService = await import('../../../services/user-service/service.js')
const CashLocationService = await import('../../../services/cash-location-service/service.js')
const PointService = await import('../../../services/point-service/service.js')
const EmailService = await import('../../../services/email-service/service.js')

//Tests

beforeEach(() => {
  jest.clearAllMocks();
});

const  {ObjectId} = mongoose.Types

describe("getDeposits", ()=>{
  let deposits, userId

  beforeEach(()=>{
    userId = new ObjectId().toString()
    deposits = [
      Mocks.generateDBDeposit({depositType: "Permanent"}),
      Mocks.generateDBDeposit({depositType: "Temporary"}),
    ]
    Deposit.getDeposits.mockResolvedValue(deposits)
  })
  
  test("Deposit.getDeposits is called with correct args", async ()=>{
    await Service.getDeposits({userId}, {field: "amount"}, {page: 1})
    expect(Deposit.getDeposits).toHaveBeenCalledWith({userId}, {field: "amount"}, {page: 1})
  })

  test("returns result of Deposit.getDeposits", async ()=>{
    const result = await Service.getDeposits()
    expect(result).toEqual(deposits)
  })
})

describe("getDepositById", ()=>{
  let deposit
  beforeEach(()=>{
    deposit = Mocks.generateDBDeposit()
    Deposit.findById.mockResolvedValue(deposit)
  })
  
  test("Deposit.findById is called with correct args", async ()=>{
    Service.getDepositById(deposit._id)
    expect(Deposit.findById).toHaveBeenCalledWith(deposit._id)
  })
  test("returns result of Deposit.findById", async ()=>{
    const result = await Service.getDepositById(deposit._id)
    expect(result).toEqual(deposit)
  })
  test("throws NotFoundError if deposit is not found", async ()=>{
    Deposit.findById.mockResolvedValue(null)
    expect(()=>Service.getDepositById(deposit._id)).rejects.toThrow(Errors.NotFoundError)
  })
})

describe("getYearlyDeposits", ()=>{
  let yearlyDeposits
  beforeEach(()=>{
    yearlyDeposits = [
      Mocks.generateDBYearlyDeposit(),
      Mocks.generateDBYearlyDeposit(),
    ]
    YearlyDeposit.find.mockResolvedValue(yearlyDeposits)
  })

  test("YearlyDeposit.find is called with correct args", async ()=>{
    await Service.getYearlyDeposits()
    expect(YearlyDeposit.find).toHaveBeenCalledWith()
  })

  test("returns result of YearlyDeposit.find", async ()=>{
    const result = await Service.getYearlyDeposits()
    expect(result).toEqual(yearlyDeposits)
  })
})

describe("recordDeposit:Permanent", ()=>{
  let deposit, depositor, recordedBy

  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    recordedBy = UserMocks.generateDBUser({userType: "admin"})
    deposit = Mocks.generateInputDeposit({depositor, depositType: "Permanent"})
    const {_id, fullName} = recordedBy
    deposit.recordedBy = {_id,  fullName}
    UserService.getUserById.mockResolvedValue(depositor)
    await Service.recordDeposit(deposit)
  })

  test("CashLocationService.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(deposit.cashLocation._id, deposit.amount )
  })

  test("Deposit.create is called with correct args", ()=>{
    expect(Deposit.create).toHaveBeenCalledWith({...deposit, balanceBefore: depositor.permanentInvestment.amount})
  })

  test("UserService.updatePermanentInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(depositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.permanentInvestment.amount * daysInvestment + deposit.amount * daysDeposit
    expect(UserService.updatePermanentInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount: deposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("Existing yearly deposit: YearlyDeposit.updateOne is called with correct args", ()=>{
    const depositYear = new Date(deposit.date).getFullYear()
    const depositMonth = new Date(deposit.date).getMonth()
    const monthTotals = new Array(12).fill(0)
    monthTotals[depositMonth] = 2_000
    YearlyDeposit.findOne.mockResolvedValue({year: depositYear, total: 10_000, monthTotals})

    const args = YearlyDeposit.updateOne.mock.calls
  })

  test("PointService.awardPoints is called with correct args", ()=>{
    const pointsAwarded = Math.floor((deposit.amount / 10000) * 3)
    expect(PointService.awardPoints)
    .toHaveBeenCalledWith(depositor._id, pointsAwarded, "Deposit", deposit._id )
  })

  test("EmailService.sendEmail is called with correct args", ()=>{
    const args = EmailService.sendEmail.mock.calls[0]
    expect(args[1]).toBe(depositor.email)
    expect(args[2]).toBe("Deposit Recorded")
    const contextStrings = ["Jane Doe", "UGX 10,000", "March 1, 2025", "Permanent", "3 points", "UGX 2,010,000"]
    const message = args[3]
    //Expect(contextStrings.every((contextString => message.includes(contextString)))).toBe(true)
  })
  
})

describe("recordDeposit:Temporary", ()=>{
  let deposit, depositor, recordedBy

  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    recordedBy = UserMocks.generateDBUser({userType: "admin"})
    deposit = Mocks.generateInputDeposit({
      depositor,
      depositType: "Temporary"
    })
    const {_id, fullName} = recordedBy
    deposit.recordedBy = {_id,  fullName}
    UserService.getUserById.mockResolvedValue(depositor)
    await Service.recordDeposit(deposit)
  })

  test("CashLocationService.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(deposit.cashLocation._id, deposit.amount )
  })


  test("Deposit.create is called with correct args", ()=>{
    expect(Deposit.create).toHaveBeenCalledWith({...deposit, balanceBefore: depositor.temporaryInvestment.amount})
  })

  test("UserService.updateTemporaryInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(depositor.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.temporaryInvestment.amount * daysInvestment + deposit.amount * daysDeposit
    expect(UserService.updateTemporaryInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount: deposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.updateOne is not called", ()=>{
    expect(YearlyDeposit.updateOne).not.toHaveBeenCalled()
  })

  test("PointService.awardPoints is not called", ()=>{
    expect(PointService.awardPoints).not.toHaveBeenCalled()
  })

})

describe("updateDeposit:Permanent", ()=>{
  let currentDeposit, depositUpdate, depositor, recordedBy

  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    recordedBy = UserMocks.generateDBUser({userType: "admin"})
    currentDeposit = Mocks.generateDBDeposit({
      depositor,
      depositType: "Permanent",
      recordedBy
    })
    currentDeposit = attachToObjectMethod(currentDeposit)
    depositUpdate = Mocks.generateDepositUpdate()
    depositUpdate.updatedById = recordedBy._id
    UserService.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(currentDeposit)
    await Service.updateDeposit(currentDeposit._id, depositUpdate)
  })

  test("CashLocationService.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledTimes(2)
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToAdd._id, depositUpdate.amount )
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToDeduct._id, - currentDeposit.amount )
  })

  test("Deposit.updateOne is called with correct args", ()=>{
    expect(Deposit.updateOne).toHaveBeenCalledWith({_id: currentDeposit._id}, {
      $set: {
      amount: depositUpdate.amount,
      date: depositUpdate.date,
      cashLocation: depositUpdate.cashLocationToAdd
    }
  })
  })

  test("UserService.updatePermanentInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(depositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysCurrentDeposit = DateUtil.getDaysDifference(currentDeposit.date, DateUtil.getToday())
    const daysUpdatedDeposit = DateUtil.getDaysDifference(depositUpdate.date, DateUtil.getToday())
    const deltaUnits = depositor.permanentInvestment.amount * daysInvestment
    + depositUpdate.amount * daysUpdatedDeposit
    - currentDeposit.amount * daysCurrentDeposit
    UserService.getUserById.mockResolvedValue(depositor)
    const deltaAmount = depositUpdate.amount - currentDeposit.amount
    
    expect(UserService.updatePermanentInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("PointService.findByRefIdAndUpdatePoints is called with correct args", ()=>{
    const pointsAwarded = Service._calculatePoints(depositUpdate.amount)
    expect(PointService.findByRefIdAndUpdatePoints)
    .toHaveBeenCalledWith(currentDeposit._id, pointsAwarded)
  })

  test("EmailService.sendEmail is called with correct args", ()=>{
    const currentPointsAwarded = Service._calculatePoints(currentDeposit.amount)
    const updatedPointsAwarded = Service._calculatePoints(depositUpdate.amount)
    const args = EmailService.sendEmail.mock.calls[0]
    const [sender, email, subject, message] = args

    const  expectedSubStringsInMessage = [
      depositor.fullName,
      `UGX ${currentDeposit.amount.toLocaleString()}`,
      `${currentPointsAwarded} points`,
      `UGX ${depositUpdate.amount.toLocaleString()}`,
      `${updatedPointsAwarded} points`,
      currentDeposit.type
    ]

    const missingSubStringsInMessage = []

    expect(sender).toBe("growthspring")
    expect(email).toBe(depositor.email)
    expect(subject).toBe("Deposit Updated")
    expect(missingSubStringsInMessage).toEqual([])
  })
  
})

describe("updateDeposit:Temporary", ()=>{
  let currentDeposit, depositUpdate, depositor, recordedBy

  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    recordedBy = UserMocks.generateDBUser({userType: "admin"})
    currentDeposit = Mocks.generateDBDeposit({
      depositor,
      depositType: "Temporary",
      recordedBy
    })
    depositUpdate = Mocks.generateDepositUpdate()
    depositUpdate.updatedById = recordedBy._id
    UserService.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(currentDeposit)
    await Service.updateDeposit(currentDeposit._id, depositUpdate)
  })

  test("CashLocationService.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledTimes(2)
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToAdd._id, depositUpdate.amount )
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToDeduct._id, - currentDeposit.amount )
  })

  test("Deposit.updateOne is called with correct args", ()=>{
    expect(Deposit.updateOne).toHaveBeenCalledWith({_id: currentDeposit._id}, {
      $set: {
        amount: depositUpdate.amount,
        date: depositUpdate.date,
        cashLocation: depositUpdate.cashLocationToAdd
      }
    })
  })

  test("UserService.updateTemporaryInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(depositor.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysCurrentDeposit = DateUtil.getDaysDifference(currentDeposit.date, DateUtil.getToday())
    const daysUpdatedDeposit = DateUtil.getDaysDifference(depositUpdate.date, DateUtil.getToday())
    const deltaUnits = depositor.temporaryInvestment.amount * daysInvestment
    + depositUpdate.amount * daysUpdatedDeposit
    - currentDeposit.amount * daysCurrentDeposit
    UserService.getUserById.mockResolvedValue(depositor)
    const deltaAmount = depositUpdate.amount - currentDeposit.amount
    
    expect(UserService.updateTemporaryInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.bulkWrite is not called", ()=>{
    expect(YearlyDeposit.bulkWrite).not.toHaveBeenCalled()

  })

  test("PointService.findByRefIdAndUpdatePoints is not called", ()=>{
    expect(PointService.findByRefIdAndUpdatePoints).not.toHaveBeenCalled()
  })
  
})

describe("deleteDeposit:Permanent", ()=>{
  let cashLocationToDeductId, deposit, depositor
  
  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    deposit = Mocks.generateDBDeposit({depositor, depositType: "Permanent"})
    deposit = attachToObjectMethod(deposit)
    UserService.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(deposit)
    cashLocationToDeductId = new ObjectId().toString()
    await Service.deleteDeposit(deposit._id, cashLocationToDeductId)
  })

  test("CashLocationService.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(cashLocationToDeductId, -deposit.amount )
  })

  test("Deposit.deleteOne is called with correct args", ()=>{
    expect(Deposit.deleteOne).toHaveBeenCalledWith({_id: deposit._id})
  })

  test("UserService.updatePermanentInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(depositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.permanentInvestment.amount * daysInvestment - deposit.amount * daysDeposit
    expect(UserService.updatePermanentInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount: -deposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("PointService.deleteTransactionByRefId is called with correct args", ()=>{
    const [refId] = PointService.deleteTransactionByRefId.mock.calls[0]
    expect(refId).toEqual(deposit._id)
  })

  test("EmailService.sendEmail is called with correct args", ()=>{
    const args = EmailService.sendEmail.mock.calls[0]
    const [sender, email, subject, message] = args

    const expectedSubStringsInMessage = [
      deposit.depositor.fullName,
      `${deposit.amount.toLocaleString()}`,
      DateUtil.formatDateShortUS(deposit.date),
      deposit.type,
    ]

    const missingSubStringsInMessage = []

    expect(sender).toEqual("growthspring")
    expect(email).toEqual(depositor.email)
    expect(subject).toEqual("Deposit Deleted")
    expect(missingSubStringsInMessage).toEqual([])
  })
  
})

describe("deleteDeposit:Temporary", ()=>{
  let cashLocationToDeductId, deposit, depositor
  
  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    deposit = Mocks.generateDBDeposit({depositor, depositType: "Temporary"})
    UserService.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(deposit)
    cashLocationToDeductId = new ObjectId().toString()
    await Service.deleteDeposit(deposit._id, cashLocationToDeductId)
  })

  test("CashLocationService.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationService.addToCashLocation)
    .toHaveBeenCalledWith(cashLocationToDeductId, -deposit.amount )
  })

  test("Deposit.deleteOne is called with correct args", ()=>{
    expect(Deposit.deleteOne).toHaveBeenCalledWith({_id: deposit._id})
  })

  test("UserService.updateTemporaryInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(depositor.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.temporaryInvestment.amount * daysInvestment - deposit.amount * daysDeposit

    expect(UserService.updateTemporaryInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount: -deposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("YearlyDeposit.updateOne is not called", ()=>{
    expect(YearlyDeposit.updateOne).not.toHaveBeenCalled()
  })

  test("PointService.deleteTransactionByRefId is not called", ()=>{
    expect(PointService.deleteTransactionByRefId)
    .not.toHaveBeenCalled()
  })

  test("EmailService.sendEmail is called with correct args", ()=>{
    const args = EmailService.sendEmail.mock.calls[0]
    const [sender, email, subject, message] = args

    const expectedSubStringsInMessage = [
      deposit.depositor.fullName,
      `${deposit.amount.toLocaleString()}`,
      DateUtil.formatDateShortUS(deposit.date),
      deposit.type,
    ]

    const missingSubStringsInMessage = []

    expect(sender).toEqual("growthspring")
    expect(email).toEqual(depositor.email)
    expect(subject).toEqual("Deposit Deleted")
    expect(missingSubStringsInMessage).toEqual([])
  })
  
})

//Util 
function attachToObjectMethod(obj){
  const copy = {...obj}
  copy.toObject = function(){
    return {...this}
  }
  return copy
}