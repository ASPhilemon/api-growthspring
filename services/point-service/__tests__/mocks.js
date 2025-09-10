import mongoose from "mongoose"
import { faker } from "@faker-js/faker"
import { v4 as uuid } from "uuid"

import * as UserMocks from "../../user-service/__tests__/mocks.js"

const { ObjectId } = mongoose.Types

const MIN_DATE = "2023-01-01"
const MAX_DATE = "2024-12-31"

export function generateDBAwardTransaction(recipient, points, refId){
  if (!recipient) recipient = UserMocks.generateDBUser();
  if (!points) points = faker.number.int({min: 1, max: 10_000});
  if (!refId) refId = new ObjectId().toHexString()

  const {_id, fullName} = recipient

  return {
    _id: new ObjectId().toHexString(),
    recipient: {
      _id,
      fullName,
    },
    points,
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}),
    reason: "Deposit Award",
    type: "award",
    refId
  }
}

export function generateDBRedeemTransaction(redeemedBy, points, refId){
  if (!redeemedBy) redeemedBy = UserMocks.generateDBUser();
  if (!points) points = faker.number.int({min: 1, max: 10_000});
  if (!refId) refId = new ObjectId().toHexString()

  const {_id, fullName} = redeemedBy

  return {
    _id: new ObjectId().toHexString(),
    redeemedBy: {
      _id,
      fullName,
    },
    points,
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}),
    type: "redeem",
    refId,
    reason: "redeem reason"
  }
}

export function generateDBTransferTransaction(recipient, sender, points){
  if (!recipient) recipient = UserMocks.generateDBUser();
  if (!sender) sender = UserMocks.generateDBUser();
  if (!points) points = faker.number.int({min: 1, max: 10_000});

  return {
    _id: new ObjectId().toHexString(),
    recipient: {
      _id: recipient._id,
      fullName: recipient.fullName,
    },
    sender: {
      _id: sender._id,
      fullName: sender.fullName,
    },
    points,
    date: faker.date.between({from: MIN_DATE, to: MAX_DATE}),
    type: "transfer",
    reason: "generous"
  }
}

export function generateInputAwardTransaction(recipient, points, refId){
  if (!recipient) recipient = UserMocks.generateDBUser();
  if (!points) points = faker.number.int({min: 1, max: 10_000});
  if (!refId) refId = new ObjectId().toHexString()

  return {
    recipientId: recipient._id,
    points,
    reason: "Deposit Award",
    type: "award",
    refId
  }
}

export function generateInputRedeemTransaction(redeemedBy, points, refId){
  if (!redeemedBy) redeemedBy = UserMocks.generateDBUser();
  if (!points) points = faker.number.int({min: 1, max: 10_000});
  if (!refId) refId = new ObjectId().toHexString()

  return {
    redeemedById: redeemedBy._id,
    points,
    reason: "Redeem Reason",
    type: "redeem",
    refId
  }
}

export function generateInputTransferTransaction(recipient, sender, points){
  if (!recipient) recipient = UserMocks.generateDBUser();
  if (!sender) sender = UserMocks.generateDBUser();
  if (!points) points = faker.number.int({min: 1, max: 10_000});

  return {
    recipientId: recipient._id,
    senderId: sender._id,
    points,
    type: "transfer",
    reason: "generous"
  }
}

export function generateDBTransactions(numberOfTransactions, {users}= {}){
  if (!users) users = UserMocks.generateDBUsers({numberOfUsers: 2});

  const perCategory = Math.floor(numberOfTransactions / 3)

  const transactions = []
  //ensure transaction dates and points and unique for deterministic sorting
  let pointsSet = new Set()
  let datesSet = new Set()

  for (let i = 0; i < perCategory;){
    let user = faker.helpers.arrayElement(users)
    let sender, recipient

    if (users[0] == user){
      sender = users[0]
      recipient = users[1]
    } else{
      sender = users[1]
      recipient = users[0]
    }
    const awardTransaction = generateDBAwardTransaction(user)
    const redeemTransaction = generateDBRedeemTransaction(user)
    const transferTransaction = generateDBTransferTransaction(recipient, sender)

    //unique dates
    if (datesSet.has(awardTransaction.date)) continue;
    datesSet.add(awardTransaction.date)
    if (datesSet.has(redeemTransaction.date)) continue;
    datesSet.add(redeemTransaction.date)
    if (datesSet.has(transferTransaction.date)) continue;
    datesSet.add(transferTransaction.date)

    //unique point quantities
    if (pointsSet.has(awardTransaction.points)) continue;
    pointsSet.add(awardTransaction.points)
    if (pointsSet.has(redeemTransaction.points)) continue;
    pointsSet.add(redeemTransaction.points)
    if (pointsSet.has(transferTransaction.points)) continue;
    pointsSet.add(transferTransaction.points)

    transactions.push(awardTransaction, redeemTransaction, transferTransaction)

    i++

  }

  return transactions

}

export function generateTransactionUpdate(){
  return {
    newPoints: faker.number.int({min: 1, max: 10_000})
  }
}