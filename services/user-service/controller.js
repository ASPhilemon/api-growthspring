import * as Service from "./service.js"
import * as Response from "../../utils/http-response-util.js"
import * as Errors from "../../utils/error-util.js"

export async function getUsers(req, res){
  const {sortBy, sortOrder, page, perPage} = req.query 
  const sort = {sortBy, sortOrder}
  const pagination = {perPage, page}
  const users = await Service.getUsers(sort, pagination)
  Response.sendSuccess(users, {req, res})
}

export async function getUserById(req, res){
  const {id: userId} = req.params
  const user = await Service.getUserById(userId)
  Response.sendSuccess(user, {req, res})
}

export async function getUserDashboard(req, res){
  if (!req.user?._id !== req.params?.id){
    throw new Errors.NotAllowedError();
  }
  const userId = req.user.isAdmin? req.params.id: req.user._id
  const dashboard = await Service.getUserDashboard(userId)
  Response.sendSuccess(dashboard, {req, res})
}

export async function createUser(req, res){
  const user = req.body
  await Service.createUser(user)
  Response.sendSuccess(null, {req, res})
}

export async function updateUser(req, res){
  const userId = req.user.isAdmin? req.params.id: req.user._id
  const update = req.body
  await Service.updateUser(userId, update)
  Response.sendSuccess(null, {req, res})
}

export async function updateUserPhoto(req, res){
  const {id: userId} = req.params
  const tempPhotoPath = req.file?.path
  await Service.updateUserPhoto(userId, tempPhotoPath)
  Response.sendSuccess(null, {req, res})
}

export async function deleteUserPhoto(req, res){
  const {id: userId} = req.params
  await Service.deleteUserPhoto(userId)
  Response.sendSuccess(null, {req, res})
}

export async function deleteUser(req, res){
  const { id: userId } = req.params
  await Service.deleteUser(userId)
  Response.sendSuccess(null, {req, res})
}

export async function transferPoints(req, res){
  const senderId = req.user._id
  const {recipientId, points, reason} = req.body
  await Service.transferPoints(senderId, recipientId, points, reason)
  Response.sendSuccess(null, {req, res})
}