import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getMe(req, res){
  const user = req.user
  Response.sendSuccess(user, {req, res})
}

export async function getMyDashboard(req, res){
  const {_id : userId } = req.user
  const dashboard = ServiceManager.getDashboard(userId)
  Response.sendSuccess(dashboard, {req, res})
}

export async function updateMe(req, res){
  const userId = req.user._id
  const { update } = req.body
  await ServiceManager.updateUser(userId, update)
  Response.sendSuccess(null, {req, res})
}

export async function deleteMe(req, res){
  const userId = req.user._id
  await ServiceManager.deleteUser(userId)
  Response.sendSuccess(null, {req, res})
}

//admin-only
export async function getUsers(req, res){
  const {sortBy, sortOrder, page, perPage} = req.query 
  const sort = {sortBy, sortOrder}
  const pagination = {perPage, page}
  const users = ServiceManager.getUsers(sort, pagination)
  Response.sendSuccess(users, {req, res})
}

export async function getUserById(req, res){
  const {id: userId} = req.params
  const user = ServiceManager.getUserById(userId)
  Response.sendSuccess(user, {req, res})
}

export async function createUser(req, res){
  const { user } = req.body
  await ServiceManager.createUser(user)
  Response.sendSuccess(null, {req, res})
}

export async function updateUser(req, res){
  const { id: userId } = req.params
  const { update } = req.body
  await ServiceManager.updateUser(userId, update)
  Response.sendSuccess(null, {req, res})
}

export async function deleteUser(req, res){
  const { id: userId } = req.params
  await ServiceManager.deleteUser(userId)
  Response.sendSuccess(null, {req, res})
}