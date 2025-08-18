import path from "path"
import { User } from "./models.js"
import fs from "fs"
import mongoose from "mongoose"
import { fileURLToPath } from "url"

const fileURL = import.meta.url
const filePath = fileURLToPath(fileURL)
const moduleDirectory = path.dirname(filePath)
const publicDirectory = path.join(moduleDirectory, "..", "..", "public")

//utils
import * as DB from "../../utils/db-util.js"
import * as Errors from "../../utils/error-util.js"
import * as DateUtil from "../../utils/date-util.js"
import * as Validator from "../../utils/validator-util.js"

//collaborator services
import * as AuthServiceManager from "../auth-service/service.js"
import * as DepositServiceManager from "../deposit-service/service.js"
import * as PointServiceManager from "../point-service/service.js"
import * as EmailServiceManager from "../email-service/service.js"

import * as Schemas from "./schemas.js"

export async function getUsers(){
  const users = await DB.query(User.find())
  return users
}

export async function getUserById(userId){
  Validator.schema(Schemas.getUserById, userId)
  const user = DB.query(User.findById(userId))
  if (!user) throw new Errors.NotFoundError("Failed to find user")
  return user
}

export async function getUserByEmail(email){
  Validator.schema(Schemas.getUserByEmail, email)
  const user = DB.query(await User.findOne({email}))
  if (!user) throw new Errors.NotFoundError("Failed to find user")
  return user
}

export async function getUserDashboard(userId){
  Validator.schema(Schemas.getUserDashboard, userId)
  const filter = {userId}
  const [
    deposits,
    clubDeposits,
  ] = await Promise.all([
    DepositServiceManager.getDeposits(filter),
    DepositServiceManager.getYearlyDeposits()
  ])

  return {
    deposits,
    clubDeposits
  }
}

export async function createUser(user){
  Validator.schema(Schemas.createUser, user)
  user = _buildUser(user)
  const {_id:userId, fullName, email} = user

  let password
  
  await DB.transaction(async()=>{
    await User.create(user)
    password = await AuthServiceManager.createPassword(userId, fullName, email)
  })

  sendUserCreatedEmail(user, password)
}

export async function updateUser(userId, update){
  Validator.schema(Schemas.updateUser, {userId, update})
  await DB.transaction(async()=>{
    const user = await getUserById(userId)
    user.set(update)
    await user.save()
  })
}

export async function updateUserRestricted(userId, update){
  Validator.schema(Schemas.updateUserRestricted, {userId, update})
  await updateUser(userId, update)
}

export async function updateUserPhoto(userId, tempPhotoPath){
  Validator.schema(Schemas.updateUserPhoto, {userId, tempPhotoPath})
  let user
  try{
    user = await getUserById(userId)
  }
  catch(err){
    //remove uploaded photo if user was not found
    if (err instanceof Errors.NotFoundError){
      fs.unlink(tempPhotoPath, (err)=>{
        throw new Errors.InternalServerError("An error occured deleting uploaded photo", err)
      })
    }

    throw err
  }

  const currentTime = DateUtil.getToday().getTime()
  const fileName = `img/${user.fullName}-${currentTime}.jpg`;
  const permPhotoPath = path.join(publicDirectory, fileName);

  //move photo to the public directory
  try{
    fs.mkdirSync(path.dirname(permPhotoPath), { recursive: true });
    fs.renameSync(tempPhotoPath, permPhotoPath)
  }
  catch(err){
    throw new Errors.InternalServerError("An error occured saving photo",  err)
  }

  //save photo reference to database
  user.photoURL = fileName
  await user.save()
}

export async function deleteUserPhoto(userId){
  Validator.schema(Schemas.deleteUserPhoto, userId)
  const user = await getUserById(userId)
  if (!user.photoURL){
    throw new Errors.BadRequestError("Failed to delete photo, photo not found")
  }
  const fileName = user.photoURL
  const filePath = path.join(publicDirectory, fileName);
  try{
    fs.unlinkSync(filePath)
  }
  catch(err){
    throw new Errors.InternalServerError("An error occured deleting photo", err)
  }

  //update user
  user.photoURL = ""
  await user.save()
}

export async function addPoints(userId, points){
  Validator.schema(Schemas.addPoints, {userId, points})
  await DB.transaction(async()=>{
    const user = await getUserById(userId)
    if (user.points + points < 0) {
      throw new Errors.BadRequestError("Insufficient points balance")
    }

    await User.updateOne({_id: userId}, {$inc: {points}})
    })
}

export async function transferPoints(senderId, recipientId, points, reason){
  Validator.schema(Schemas.transferPoints, {senderId, recipientId, points, reason})
  await PointServiceManager.transferPoints(senderId, recipientId, points, reason)
}

export async function updatePermanentInvestment(userId, {deltaAmount, deltaUnits, newUnitsDate}){
  Validator.schema(Schemas.updatePermanentInvestment, {userId, update: {
    deltaAmount,
    deltaUnits,
    newUnitsDate,
  }})

  let update = {$set: {}, $inc: {}}
  if (newUnitsDate) update.$set["permanentInvestment.unitsDate"] = newUnitsDate
  if (deltaAmount) update.$inc["permanentInvestment.amount"] = deltaAmount
  if (deltaUnits) update.$inc["permanentInvestment.units"] = deltaUnits
  await DB.query(User.updateOne({_id: userId}, update))
}

export async function updateTemporaryInvestment(userId, {deltaAmount, deltaUnits, newUnitsDate}){
  Validator.schema(Schemas.updateTemporaryInvestment, {userId, update: {
    deltaAmount,
    deltaUnits,
    newUnitsDate
  }})

  let update = {$set: {}, $inc: {}}
  if (newUnitsDate) update.$set["temporaryInvestment.unitsDate"] = newUnitsDate
  if (deltaAmount) update.$inc["temporaryInvestment.amount"] = deltaAmount
  if (deltaUnits) update.$inc["temporaryInvestment.units"] = deltaUnits

  await DB.query(User.updateOne({_id: userId}, update))
}

export async function deleteUser(userId){
  Validator.schema(Schemas.deleteUser, userId)
  await DB.query(User.updateOne({_id: userId}, {
    $set: {
      isActive: false
    }
  }))
}

export async function sendUserCreatedEmail(user, password){
  EmailServiceManager.sendEmail({
    sender: "accounts",
    recipient: user.email,
    subject: "Account Created",
    message: `Dear ${user.fullName}, your growthspring account has been created successfuly. Your default login password is: ${password}`
  })
}

//helpers
function _buildUser(user){
  user = {
    ...user,
    _id: new mongoose.Types.ObjectId().toHexString(),
    membershipDate: DateUtil.getToday(),
    permanentInvestment: {
      amount: 0,
      units: 0,
      unitsDate: DateUtil.getToday()
    },
    temporaryInvestment: {
      amount: 0,
      units: 0,
      unitsDate: DateUtil.getToday()
    },
    points: 500,
    isActive: true,
  }

  return user
}