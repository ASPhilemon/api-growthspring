import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

//all users
export async function getMe(req, res){
  const user = await ServiceManager.getUserById(req.user._id)
  Response.sendSuccess(user, {req, res})
}

export async function getMyDashboard(req, res){
  const {_id : userId } = req.user
  const dashboard = await ServiceManager.getUserDashboard(userId)
  Response.sendSuccess(dashboard, {req, res})
}

export async function updateMe(req, res){
  const userId = req.user._id
  const update = req.body
  await ServiceManager.updateUserRestricted(userId, update)
  Response.sendSuccess(null, {req, res})
}

export async function updateMyPhoto(req, res){
  const userId = req.user._id
  const tempPhotoPath = req.file?.path
  await ServiceManager.updateUserPhoto(userId, tempPhotoPath)
  Response.sendSuccess(null, {req, res})
}

export async function deleteMyPhoto(req, res){
  const userId = req.user._id
  await ServiceManager.deleteUserPhoto(userId)
  Response.sendSuccess(null, {req, res})
}

export async function transferPoints(req, res){
  const senderId = req.user._id
  const {recipientId, points, reason} = req.body
  await ServiceManager.transferPoints(senderId, recipientId, points, reason)
  Response.sendSuccess(null, {req, res})
}

//admin-only
export async function getUsers(req, res){
  const {sortBy, sortOrder, page, perPage} = req.query 
  const sort = {sortBy, sortOrder}
  const pagination = {perPage, page}
  const users = await ServiceManager.getUsers(sort, pagination)
  Response.sendSuccess(users, {req, res})
}

export async function getUserById(req, res){
  const {id: userId} = req.params
  const user = await ServiceManager.getUserById(userId)
  Response.sendSuccess(user, {req, res})
}

export async function getUserDashboard(req, res){
  const {id : userId } = req.params
  const dashboard = await ServiceManager.getUserDashboard(userId)
  Response.sendSuccess(dashboard, {req, res})
}

export async function createUser(req, res){
  const user = req.body
  await ServiceManager.createUser(user)
  Response.sendSuccess(null, {req, res})
}

export async function updateUser(req, res){
  const { id: userId } = req.params
  const update = req.body
  await ServiceManager.updateUser(userId, update)
  Response.sendSuccess(null, {req, res})
}

export async function updateUserPhoto(req, res){
  const {id: userId} = req.params
  const tempPhotoPath = req.file?.path
  await ServiceManager.updateUserPhoto(userId, tempPhotoPath)
  Response.sendSuccess(null, {req, res})
}

export async function deleteUserPhoto(req, res){
  const {id: userId} = req.params
  await ServiceManager.deleteUserPhoto(userId)
  Response.sendSuccess(null, {req, res})
}

export async function deleteUser(req, res){
  const { id: userId } = req.params
  await ServiceManager.deleteUser(userId)
  Response.sendSuccess(null, {req, res})
}