import mongoose from "mongoose";
import * as DB from "../../utils/db-util.js"

//schemas
const investmentSubSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  units: {
    type: Number,
    required: true,
  },
  unitsDate: {
    type: Date,
    required: true,
  }
}, {_id: false})

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  phoneContact: {
    type: String,
    required: true
  },
  membershipDate: {
    type: Date,
    required: true
  },
  permanentInvestment: {
    type: investmentSubSchema,
    required: true
  },
  temporaryInvestment: {
    type: investmentSubSchema,
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  isAdmin: Boolean,
  displayName: String,
  photoURL: String,
  deleted: Boolean
})

//models
const User  = mongoose.model(
  'user',
  userSchema
);

//custom static methods on model
userSchema.statics.getUsers = async function(
  sort = {field: "fullName", order: 1},
  pagination = {page: 1, perPage: 50}
){
  const users = await DB.query(
    this.find()
    .filter({deleted:false})
    .sort({[sort.field]: sort.order})
    .skip( pagination.perPage*(pagination.page - 1))
    .limit()
  )
  return users
}

export { User }