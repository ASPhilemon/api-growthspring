
import mongoose from "mongoose";
import * as DB from "../../utils/db-util.js"; 

const { ObjectId } = mongoose.Types;

const MonthlyInterestRecordSchema = new mongoose.Schema({
  monthYear: { type: String, required: true, unique: true }, // Format: "YYYY-MM"
  totalCashInterestAccrued: { type: Number, required: true, default: 0 },
  source: {
    type: String,
    enum: ["Loans", "Unit Trusts"], 
    required: true
  },
}, { timestamps: true });

MonthlyInterestRecordSchema.index({ monthYear: 1 });


// --- Schema for Earnings ---
const earningsSchema = new mongoose.Schema({
   fullName: {
    type: String,
    required: true
  },
  _id: {
    type: ObjectId,
    required: true
  },
  date: { 
    type: Date,
    required: true
  },
  amount: { 
    type: Number,
    required: true
  },
  destination: {
    type: String,
    enum: ["Re-Invested", "Withdrawn"],
    required: true
  },
  source: {
    type: String,
    enum: ["Permanent Savings", "Temporary Savings"], 
    required: true
  },
  status: {
    type: String,
    enum: ["Sent", "Pending", "Failed"], 
    default: "Sent"
  },
}, { timestamps: true }); 


// --- Custom Static Methods for Earnings ---
earningsSchema.statics.getFilteredEarnings = async function({
  filter,
  sort = { field: "date", order: -1 }, // Default sort by date descending
  pagination = { page: 1, perPage: 200 }
}) {
  const pipeline = [];

  // Match stage
  const matchStage = {};
  const matchCriteria = [];

  if (filter?.year) {
    matchCriteria.push({ $expr: { $eq: [{ $year: "$date" }, filter.year] } });
  }
  if (filter?.memberId) {
    matchCriteria.push({ "_id": new ObjectId(filter.memberId) }); 
  }
  if (filter?.destination) {
    matchCriteria.push({ destination: filter.destination });
  }  
  if (filter?.source) {
    matchCriteria.push({ source: filter.source });
  }

  if (matchCriteria.length > 0) {
    matchStage.$and = matchCriteria;
  }
  pipeline.push({ $match: matchStage });

  // Sort stage
  pipeline.push({ $sort: { [sort.field]: sort.order } });

  // Pagination stages
  pipeline.push({ $skip: (pagination.page - 1) * pagination.perPage });
  pipeline.push({ $limit: pagination.perPage });

  pipeline.push({
    $lookup: {
      from: "users", 
      localField: "beneficiary._id",
      foreignField: "_id",
      as: "beneficiary"
    }
  });

  // Add fields stage to replace beneficiary single element array with user object
  pipeline.push({
    $addFields: {
      beneficiary: { $arrayElemAt: ["$beneficiary", 0] }
    }
  });

  // Execute pipeline
  return await DB.query(this.aggregate(pipeline)); // Use 'this' to refer to the model
};


// --- Schema for Units ---
const unitsSchema = new mongoose.Schema({
    fullName: {
    type: String,
    required: true
        },
  year: {
    type: Number,
    required: true,
    min: 1900,
    max: 3000 
  },
  units: {
    type: Number,
    required: true,
    min: 0
  },
}, { timestamps: true });

// Add a unique compound index to prevent duplicate unit records for a member in a given year
unitsSchema.index({ "beneficiary._id": 1, year: 1 }, { unique: true });


// --- Schema for FundTransactions ---
const fundTransactionsSchema = new mongoose.Schema({
  name: { 
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  transaction_type: { 
    type: String,
    enum: ["Income", "Expense"],
    required: true
  },
  reason: { 
    type: String,
    required: true
  },
  recordedBy: { 
    type: {
      _id: { type: ObjectId },
      fullName: { type: String }
    }
  }
}, { timestamps: true });


// --- Models ---
const Earnings = mongoose.model('Earnings', earningsSchema);
const Units = mongoose.model('Units', unitsSchema);
const FundTransactions = mongoose.model('FundTransactions', fundTransactionsSchema);
const MonthlyInterestRecord = mongoose.model('MonthlyInterestRecord', MonthlyInterestRecordSchema);

export { Earnings, Units, FundTransactions, MonthlyInterestRecord };