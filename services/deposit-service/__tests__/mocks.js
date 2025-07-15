import {v4 as uuid} from "uuid"
import mongoose from "mongoose"

const { ObjectId } = mongoose.Types

export function createDBUser(userType){
  let dbUser = {
    _id: new ObjectId().toString(),
    fullName: "Jane Doe",
    membershipDate: new Date("2024-01-01"),
    points: 500,
    temporaryInvestment: {amount: 1_000_000, units: 100, unitsDate: new Date("2025-05-01T00:00:00Z")}, // May 1, 2025
    permanentInvestment: {amount: 2_000_000, units: 200, unitsDate: new Date("2025-04-01T00:00:00Z")}, // April 1, 2025
    email: "janedoe@gmail.com",
    phoneContact: "0772126710",
    isAdmin: userType == "admin"? true: false
  }
  return dbUser
}

export function createInputDeposit(dbUser, depositType, cashLocation){
  if (!cashLocation) cashLocation = createInputCashLocation()

  let inputDeposit = {
    _id: uuid(),
    depositor: {_id: dbUser._id, fullName: dbUser.fullName},
    date: "2025-03-01T00:00:00.000Z", //March 1, 2025
    amount: 10_000,
    type: depositType,
    recordedBy:  {_id: new ObjectId().toString(), fullName: "Admin User"},
    source: "Savings",
    cashLocation,
  }

  return inputDeposit
}

export function createDBDeposit(dbUser, depositType, recordedBy, cashLocation){
  if (!dbUser) dbUser = createDBUser("regular");
  if(!depositType) depositType = "Permanent";
  if(!recordedBy) recordedBy = {_id: new ObjectId().toString(), fullName: "Admin User"};
  if(!cashLocation) cashLocation = createInputCashLocation();

  let dbDeposit = {
    _id: uuid(),
    depositor: {_id: dbUser._id, fullName: dbUser.fullName},
    date: "2025-03-01T00:00:00.000Z", //March 1, 2025
    amount: 100_000,
    type: depositType,
    balanceBefore: 1_900_000,
    pointsBefore: 500,
    recordedBy,  
    source: "Savings",
    cashLocation,
  }
  return dbDeposit
}

export function createDepositUpdate(){
  let depositUpdate = {
    amount: 200_000,
    date: "2025-05-31T00:00:00.000Z", //May 31, 2025
    cashLocationToAdd: {_id: new ObjectId().toString(), name: "Standard Chartered"},
    cashLocationToDeduct: {_id: new ObjectId().toString(), name: "Mobile Money"},
  }
  return depositUpdate
}

export function createDBCashLocation(
  cashLocationId = new ObjectId().toString(),
  cashLocationName = "Mobile Money"
){
  const cashLocation = {_id: cashLocationId, name: cashLocationName, amount: 1_000_000};
  return cashLocation
}

export function createInputCashLocation(
  cashLocationId = new ObjectId().toString(),
  cashLocationName = "Mobile Money"
){
  const cashLocation = {_id: cashLocationId, name: cashLocationName};
  return cashLocation
}