import mongoose from "mongoose";
import * as DB from "../../utils/db-util.js"; // Assuming db-util for tryMongoose

const { ObjectId } = mongoose.Types;

// --- Loan Schema ---
const loanSchema = new mongoose.Schema({
  loan_duration: { type: Number, required: true },
  loan_rate: { type: Number, required: true },
  earliest_date: { type: Date, required: true },
  latest_date: { type: Date, required: true },
  loan_status: { type: String, required: true, enum: ["Pending Approval", "Ongoing", "Ended", "Cancelled"] },
  initiated_by: { type: String, required: true }, 
  approved_by: { type: String }, 
  worth_at_loan: { type: Number, required: true },
  loan_amount: { type: Number, required: true },
  loan_date: { type: Date }, 
  borrower_name: { type: String, required: true }, 
  points_spent: { type: Number, default: 0 },
  principal_left: { type: Number, required: true },
  last_payment_date: { type: Date, required: true },
  loan_units: { type: Number, default: 0 },
  rate_after_discount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  points_worth_bought: { type: Number, default: 0 },
  points_accrued: { type: Number, default: 0 },
  interest_accrued: { type: Number, default: 0 },
  interest_amount: { type: Number, required: true },
  installment_amount: { type: Number, required: true },
  
  sources: [{
    id: { type: ObjectId, required: true }, 
    name: { type: String, required: true }, 
    amount: { type: Number, required: true }
  }],
  payments: [{
    payment_date: { type: Date, required: true },
    payment_amount: { type: Number, required: true },
    updated_by: { type: String, required: true }, 
    payment_location: { type: ObjectId, required: true }, 
    _id: false 
  }],
}, { timestamps: true });

// Custom static method for filtering/sorting loans
loanSchema.statics.getLoans = async function({
  filter,
  sort = { field: "loan_date", order: -1 }, // Default sort by most recent loan
  pagination = { page: 1, perPage: 20 }
}) {
  const pipeline = [];
  const matchCriteria = [];

  // Match stage
  if (filter?.year) matchCriteria.push({ $expr: { $eq: [{ $year: "$loan_date" }, filter.year] } });
  if (filter?.month) matchCriteria.push({ $expr: { $eq: [{ $month: "$loan_date" }, filter.month] } });
  if (filter?.borrowerId) matchCriteria.push({ "borrower.userId": filter.borrowerId }); // Assuming 'borrower' sub-schema

  if (matchCriteria.length > 0) pipeline.push({ $match: { $and: matchCriteria } });

  // Sort stage
  pipeline.push({ $sort: { [sort.field]: sort.order } });

  // Skip and Limit for pagination
  pipeline.push({ $skip: (pagination.page - 1) * pagination.perPage });
  pipeline.push({ $limit: pagination.perPage });

  return await DB.tryMongoose(Loan.aggregate(pipeline));
};


// --- Constants Schema ---
const constantsSchema = new mongoose.Schema({
  one_point_value: { type: Number, required: true },
  max_lending_rate: { type: Number, required: true },
  min_lending_rate: { type: Number, required: true },
  annual_tax_rate: { type: Number, required: true },
  max_credits: { type: Number, required: true },
  min_discount: { type: Number, required: true },
  discount_profit_percentage: { type: Number, required: true },
  monthly_lending_rate: { type: Number, required: true },
  loan_risk: { type: Number, required: true },
  members_served_percentage: { type: Number, required: true },
  loan_multiple: { type: Number, required: true }
}, { timestamps: true });


// --- PointsSale Schema (renamed from transfersSchema for clarity) ---
const pointsSaleSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Consider changing to { userId: ObjectId, name: String }
  transaction_date: { type: Date, required: true },
  points_worth: { type: Number, required: true },
  recorded_by: { type: String, required: true }, // Consider changing to { userId: ObjectId, name: String }
  points_involved: { type: Number, required: true },
  reason: { type: String, required: true },
  type: { type: String, required: true, enum: ["Spent", "Earned", "Bought", "Sold"] }, // Added more enum values for clarity
}, { timestamps: true });


// --- Models ---
const Loan = mongoose.model('Loan', loanSchema);
const Constants = mongoose.model('Constant', constantsSchema); 
const PointsSale = mongoose.model('PointsSale', pointsSaleSchema);


// --- Exports ---
export {
  Loan,
  Constants,
  PointsSale,
};