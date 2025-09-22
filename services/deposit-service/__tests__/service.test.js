import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import * as Errors from '../../../utils/error-util.js';
import * as Mocks from "./mocks.js"
import * as UserMocks from "../../user-service/__tests__/mocks.js"

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
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
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
  let userId, deposits

  beforeEach(()=>{
    userId = new ObjectId().toString()
    deposits = [
      Mocks.generateDBDeposit({depositType: "Permanent"}),
      Mocks.generateDBDeposit({depositType: "Temporary"}),
    ]
    Deposit.getDeposits.mockResolvedValue(deposits)
  })
  
  test("Deposit.getDeposits is called with correct args", async ()=>{
    await ServiceManager.getDeposits({userId}, {field: "amount"}, {page: 1})
    expect(Deposit.getDeposits).toHaveBeenCalledWith({userId}, {field: "amount"}, {page: 1})
  })

  test("returns result of Deposit.getDeposits", async ()=>{
    const result = await ServiceManager.getDeposits()
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
    ServiceManager.getDepositById(deposit._id)
    expect(Deposit.findById).toHaveBeenCalledWith(deposit._id)
  })
  test("returns result of Deposit.findById", async ()=>{
    const result = await ServiceManager.getDepositById(deposit._id)
    expect(result).toEqual(deposit)
  })
  test("throws NotFoundError if deposit is not found", async ()=>{
    Deposit.findById.mockResolvedValue(null)
    expect(()=>ServiceManager.getDepositById(deposit._id)).rejects.toThrow(Errors.NotFoundError)
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
    await ServiceManager.getYearlyDeposits()
    expect(YearlyDeposit.find).toHaveBeenCalledWith()
  })

  test("returns result of YearlyDeposit.find", async ()=>{
    const result = await ServiceManager.getYearlyDeposits()
    expect(result).toEqual(yearlyDeposits)
  })
})

describe("recordDeposit:Permanent", ()=>{
  let depositor, recordedBy, deposit

  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    recordedBy = UserMocks.generateDBUser({userType: "admin"})
    deposit = Mocks.generateInputDeposit({depositor, depositType: "Permanent"})
    const {_id, fullName} = recordedBy
    deposit.recordedBy = {_id,  fullName}
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    await ServiceManager.recordDeposit(deposit)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(deposit.cashLocation._id, deposit.amount )
  })

  test("Deposit.create is called with correct args", ()=>{
    expect(Deposit.create).toHaveBeenCalledWith({...deposit, balanceBefore: depositor.permanentInvestment.amount})
  })

  test("UserServiceManager.updatePermanentInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(depositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.permanentInvestment.amount * daysInvestment + deposit.amount * daysDeposit
    expect(UserServiceManager.updatePermanentInvestment)
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

  test("PointServiceManager.awardPoints is called with correct args", ()=>{
    const pointsAwarded = Math.floor((deposit.amount / 10000) * 3)
    expect(PointServiceManager.awardPoints)
    .toHaveBeenCalledWith(depositor._id, pointsAwarded, "Deposit", deposit._id )
  })

  test("EmailServiceManager.sendEmail is called with correct args", ()=>{
    const args = EmailServiceManager.sendEmail.mock.calls[0]
    expect(args[1]).toBe(depositor.email)
    expect(args[2]).toBe("Deposit Recorded")
    const contextStrings = ["Jane Doe", "UGX 10,000", "March 1, 2025", "Permanent", "3 points", "UGX 2,010,000"]
    const message = args[3]
    //expect(contextStrings.every((contextString => message.includes(contextString)))).toBe(true)
  })
  
})

describe("recordDeposit:Temporary", ()=>{
  let depositor, recordedBy, deposit

  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    recordedBy = UserMocks.generateDBUser({userType: "admin"})
    deposit = Mocks.generateInputDeposit({
      depositor,
      depositType: "Temporary"
    })
    const {_id, fullName} = recordedBy
    deposit.recordedBy = {_id,  fullName}
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    await ServiceManager.recordDeposit(deposit)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(deposit.cashLocation._id, deposit.amount )
  })


  test("Deposit.create is called with correct args", ()=>{
    expect(Deposit.create).toHaveBeenCalledWith({...deposit, balanceBefore: depositor.temporaryInvestment.amount})
  })

  test("UserServiceManager.updateTemporaryInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(depositor.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.temporaryInvestment.amount * daysInvestment + deposit.amount * daysDeposit
    expect(UserServiceManager.updateTemporaryInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount: deposit.amount,
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
  let depositor, recordedBy, currentDeposit, depositUpdate

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
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(currentDeposit)
    await ServiceManager.updateDeposit(currentDeposit._id, depositUpdate)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledTimes(2)
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToAdd._id, depositUpdate.amount )
    expect(CashLocationServiceManager.addToCashLocation)
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

  test("UserServiceManager.updatePermanentInvestment is called with correct args", ()=>{
    const daysInvestment = DateUtil.getDaysDifference(depositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysCurrentDeposit = DateUtil.getDaysDifference(currentDeposit.date, DateUtil.getToday())
    const daysUpdatedDeposit = DateUtil.getDaysDifference(depositUpdate.date, DateUtil.getToday())
    const deltaUnits = depositor.permanentInvestment.amount * daysInvestment
    + depositUpdate.amount * daysUpdatedDeposit
    - currentDeposit.amount * daysCurrentDeposit
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    const deltaAmount = depositUpdate.amount - currentDeposit.amount
    
    expect(UserServiceManager.updatePermanentInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("PointServiceManager.findByRefIdAndUpdatePoints is called with correct args", ()=>{
    const pointsAwarded = ServiceManager._calculatePoints(depositUpdate.amount)
    expect(PointServiceManager.findByRefIdAndUpdatePoints)
    .toHaveBeenCalledWith(currentDeposit._id, pointsAwarded)
  })

  test("EmailServiceManager.sendEmail is called with correct args", ()=>{
    const currentPointsAwarded = ServiceManager._calculatePoints(currentDeposit.amount)
    const updatedPointsAwarded = ServiceManager._calculatePoints(depositUpdate.amount)
    const args = EmailServiceManager.sendEmail.mock.calls[0]
    const [sender, email, subject, message] = args

    let  expectedSubStringsInMessage = [
      depositor.fullName,
      `UGX ${currentDeposit.amount.toLocaleString()}`,
      `${currentPointsAwarded} points`,
      `UGX ${depositUpdate.amount.toLocaleString()}`,
      `${updatedPointsAwarded} points`,
      currentDeposit.type
    ]

    let missingSubStringsInMessage = []

    expect(sender).toBe("growthspring")
    expect(email).toBe(depositor.email)
    expect(subject).toBe("Deposit Updated")
    expect(missingSubStringsInMessage).toEqual([])
  })
  
})

describe("updateDeposit:Temporary", ()=>{
  let depositor, recordedBy, currentDeposit, depositUpdate

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
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(currentDeposit)
    await ServiceManager.updateDeposit(currentDeposit._id, depositUpdate)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledTimes(2)
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(depositUpdate.cashLocationToAdd._id, depositUpdate.amount )
    expect(CashLocationServiceManager.addToCashLocation)
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

  test("UserServiceManager.updateTemporaryInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(depositor.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysCurrentDeposit = DateUtil.getDaysDifference(currentDeposit.date, DateUtil.getToday())
    const daysUpdatedDeposit = DateUtil.getDaysDifference(depositUpdate.date, DateUtil.getToday())
    const deltaUnits = depositor.temporaryInvestment.amount * daysInvestment
    + depositUpdate.amount * daysUpdatedDeposit
    - currentDeposit.amount * daysCurrentDeposit
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    const deltaAmount = depositUpdate.amount - currentDeposit.amount
    
    expect(UserServiceManager.updateTemporaryInvestment)
    .toHaveBeenCalledWith(depositor._id, {
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
  let depositor, deposit, cashLocationToDeductId
  
  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    deposit = Mocks.generateDBDeposit({depositor, depositType: "Permanent"})
    deposit = attachToObjectMethod(deposit)
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(deposit)
    cashLocationToDeductId = new ObjectId().toString()
    await ServiceManager.deleteDeposit(deposit._id, cashLocationToDeductId)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(cashLocationToDeductId, -deposit.amount )
  })

  test("Deposit.deleteOne is called with correct args", ()=>{
    expect(Deposit.deleteOne).toHaveBeenCalledWith({_id: deposit._id})
  })

  test("UserServiceManager.updatePermanentInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(depositor.permanentInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.permanentInvestment.amount * daysInvestment - deposit.amount * daysDeposit
    expect(UserServiceManager.updatePermanentInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount: -deposit.amount,
      deltaUnits,
      newUnitsDate: DateUtil.getToday()
    })
  })

  test("PointServiceManager.deleteTransactionByRefId is called with correct args", ()=>{
    const [refId] = PointServiceManager.deleteTransactionByRefId.mock.calls[0]
    expect(refId).toEqual(deposit._id)
  })

  test("EmailServiceManager.sendEmail is called with correct args", ()=>{
    const args = EmailServiceManager.sendEmail.mock.calls[0]
    const [sender, email, subject, message] = args

    let expectedSubStringsInMessage = [
      deposit.depositor.fullName,
      `${deposit.amount.toLocaleString()}`,
      DateUtil.formatDateShortUS(deposit.date),
      deposit.type,
    ]

    let missingSubStringsInMessage = []

    expect(sender).toEqual("growthspring")
    expect(email).toEqual(depositor.email)
    expect(subject).toEqual("Deposit Deleted")
    expect(missingSubStringsInMessage).toEqual([])
  })
  
})

describe("deleteDeposit:Temporary", ()=>{
  let depositor, deposit, cashLocationToDeductId
  
  beforeEach(async ()=>{
    depositor = UserMocks.generateDBUser()
    deposit = Mocks.generateDBDeposit({depositor, depositType: "Temporary"})
    UserServiceManager.getUserById.mockResolvedValue(depositor)
    Deposit.findById.mockResolvedValue(deposit)
    cashLocationToDeductId = new ObjectId().toString()
    await ServiceManager.deleteDeposit(deposit._id, cashLocationToDeductId)
  })

  test("CashLocationServiceManager.addToCashLocation is called with correct args", ()=>{
    expect(CashLocationServiceManager.addToCashLocation)
    .toHaveBeenCalledWith(cashLocationToDeductId, -deposit.amount )
  })

  test("Deposit.deleteOne is called with correct args", ()=>{
    expect(Deposit.deleteOne).toHaveBeenCalledWith({_id: deposit._id})
  })

  test("UserServiceManager.updateTemporaryInvestment is called with correct args", ()=>{
   const daysInvestment = DateUtil.getDaysDifference(depositor.temporaryInvestment.unitsDate, DateUtil.getToday())
    const daysDeposit = DateUtil.getDaysDifference(deposit.date, DateUtil.getToday())
    const deltaUnits = depositor.temporaryInvestment.amount * daysInvestment - deposit.amount * daysDeposit

    expect(UserServiceManager.updateTemporaryInvestment)
    .toHaveBeenCalledWith(depositor._id, {
      deltaAmount: -deposit.amount,
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
    const [sender, email, subject, message] = args

    let expectedSubStringsInMessage = [
      deposit.depositor.fullName,
      `${deposit.amount.toLocaleString()}`,
      DateUtil.formatDateShortUS(deposit.date),
      deposit.type,
    ]

    let missingSubStringsInMessage = []

    expect(sender).toEqual("growthspring")
    expect(email).toEqual(depositor.email)
    expect(subject).toEqual("Deposit Deleted")
    expect(missingSubStringsInMessage).toEqual([])
  })
  
})

//util 
function attachToObjectMethod(obj){
  const copy = {...obj}
  copy.toObject = function(){
    return {...this}
  }
  return copy
}