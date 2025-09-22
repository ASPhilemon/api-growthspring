import mongoose from "mongoose";


//utils
import * as DB from "../../utils/db-util.js"

const { ObjectId } = mongoose.Types

//schemas
const userSubSchema = new mongoose.Schema({
  _id: {
    type: ObjectId,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
})
const cashLocationSubSchema = new mongoose.Schema({
  _id: {
    type: ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
})

const depositSchema = new mongoose.Schema({
    _id: {
      type: String,
      required: true
    },
    depositor: {
      type: userSubSchema,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    amount:{
      type: Number,
      min: 1,
      required: true
    },
    type:{
      type:"String",
      enum: ["Permanent", "Temporary"],
      required: true
    },
    recordedBy: {
      type: userSubSchema,
      required: true
    },
    source: {
      type: String,
      enum: ["Savings", "Profits", "Excess Loan Payment", "Interest"],
      required: true
    },
    cashLocation: {
      type: cashLocationSubSchema,
      required: true
    },
    balanceBefore: {
      type: Number,
      min: 0,
      required: true
    },
    pointsBefore: {
      type: Number,
      min: 0,
      required: true
    },
  }, { timestamps:true }
);

const yearlyDepositSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
  },
  total:{
    type: Number,
    required: true
  },
  monthTotals: {
    type : Array,
    required: true
  }
})

//custom static methods on model
depositSchema.statics.getDeposits = async function(
  filter,
  sort,
  pagination
){
    //set args to defaults if undefined 
    const sortField = sort?.field || "date"
    const sortOrder = sort?.order || -1
    const page = pagination?.page || 1
    const perPage = pagination?.perPage || 20

    const pipeline = [];
    // match stage
    const matchStage = {};
    const matchCriteria = [];
    if (filter?.year) matchCriteria.push({ $expr: { $eq: [{ $year: "$date" }, filter.year] }});
    if (filter?.month) matchCriteria.push({ $expr: { $eq: [{ $month: "$date" }, filter.month]}});
    if (filter?.userId) matchCriteria.push({ "depositor._id": ObjectId.createFromHexString(filter.userId) });

    if (matchCriteria.length > 0) matchStage.$and = matchCriteria
    pipeline.push({ $match: matchStage });

    // sort stage
    pipeline.push({ $sort: { [sortField]: sortOrder} });

    // skip and Limit stages for pagination
    pipeline.push({ $skip: (page - 1) * perPage });
    pipeline.push({ $limit: perPage });

    //execute pipeline
    return await DB.query(this.aggregate(pipeline))
}

//models
const Deposit  = mongoose.model('deposit', depositSchema );
const YearlyDeposit  = mongoose.model('yearly-deposit', yearlyDepositSchema );


export { Deposit, YearlyDeposit }