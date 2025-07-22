import mongoose from "mongoose"
import { faker } from "@faker-js/faker"

const { ObjectId } = mongoose.Types

export function generateDBAwardTransaction(recipient, points, refId){
  const {_id, fullName} = recipient
  return {
    type: "award",
    recipient: {
      _id,
      fullName,
    },
    points,
    reason: "Deposit Award",
    refId
  }
}

export function generateDBRedeemTransaction(redeemedBy, points, refId){
  const {_id, fullName} = redeemedBy
  return {
    type: "redeem",
    redeemedBy: {
      _id,
      fullName,
    },
    points,
    reason: "redeem reason"
  }
}

export function generateDBTransferTransaction(recipient, sender, points){
  return {
    type: "transfer",
    recipient: {
      _id: recipient._id,
      fullName: recipient.fullName,
    },
    sender: {
      _id: sender._id,
      fullName: sender.fullName,
    },
    points,
    reason: "generous"
  }
}