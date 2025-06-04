import * as ServiceManager from "./service.js"
import * as Response from "../../utils/http-response-util.js"

export async function getUsers(req, res){
  const {sortBy, sortOrder, page, perPage} = req.query 
  const sort = {sortBy, sortOrder}
  const pagination = {perPage, page}
  const users = ServiceManager.getUsers(sort, pagination)
  Response.sendSuccess(res, users)
}

export async function getUserById(req, res){
  const {id: userId} = req.params
  const user = ServiceManager.getUserById(userId)
  Response.sendSuccess(res, user)
}

export async function createUser(req, res){
  const { user } = req.body
  await ServiceManager.createUser(user)
  Response.sendSuccess(res, null)
}

export async function updateUser(req, res){
  const { id: userId } = req.params
  const { update } = req.body
  await ServiceManager.updateUser(userId, update)
  Response.sendSuccess(res, null)
}

export async function deleteUser(req, res){
  const { id: userId } = req.params
  await ServiceManager.deleteUser(userId)
  Response.sendSuccess(res, null)
}

export async function getMe(req, res){
  Response.sendSuccess(res, req.user)
}

export async function getMyDashboard(req, res){
  const userId = req.user._id
  const dashboard = ServiceManager.getDashboard(userId)
  Response.sendSuccess(res, dashboard)
}

export async function updateMe(req, res){
  const userId = req.user._id
  const { update } = req.body
  await ServiceManager.updateUser(userId, update)
  Response.sendSuccess(res, null)
}

export async function deleteMe(req, res){
  const userId = req.user._id
  await ServiceManager.deleteUser(userId)
  Response.sendSuccess(res, null)
}