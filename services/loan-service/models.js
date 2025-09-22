import mongoose from "mongoose";
import * as DB from "../../utils/db-util.js";

const { ObjectId } = mongoose.Types;

// --- Loan Schema ---
const loanSchema = new mongoose.Schema({
  duration: { type: Number, required: true },
  rate: { type: Number, required: true },
  earliestDate: { type: Date, required: true },
  latestDate: { type: Date, required: true },
  type: { type: String, required: true },
  status: { type: String, required: true, enum: ["Pending Approval", "Ongoing", "Ended", "Cancelled"] },
  initiatedBy: {
    id: { type: ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true }
  },
  approvedBy: {
    id: { type: ObjectId, ref: 'User' },
    name: { type: String }
  },
  worthAtLoan: { type: Number, required: true },
  amount: { type: Number, required: true },
  date: { type: Date }, // Renamed from loan_date in your example for consistency
  borrower: {
    id: { type: ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true } 
  },
  pointsSpent: { type: Number, default: 0 },
  principalLeft: { type: Number, required: true },
  lastPaymentDate: { type: Date, required: true },
  units: { type: Number, default: 0 },
  rateAfterDiscount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  pointsWorthBought: { type: Number, default: 0 },
  comment: { type: String },
  pointsAccrued: { type: Number, default: 0 },
  interestAccrued: { type: Number, default: 0 },
  interestAmount: { type: Number, required: true },
  installmentAmount: { type: Number, required: true },

  sources: [{
    id: { type: ObjectId, required: true, ref: 'CashLocation' },
    amount: { type: Number, required: true }
  }],
  payments: [{
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    updatedBy: {
      id: { type: ObjectId, required: true, ref: 'User' },
      name: { type: String, required: true }
    },
    location: { type: ObjectId, required: true, ref: 'CashLocation' },
    _id: false
  }],
}, { timestamps: true });


// Define a static method for filtered loan retrieval
loanSchema.statics.getFilteredLoans = async function({
  userId, 
  year,
  status, 
  page = 1, 
  month,
  type,
  order = -1, 
  sortBy = "date", 
  perPage = 2000, // keep your default
}) {
  if (typeof year === "string") year = Number(year);

  const pipeline = [];
  const matchCriteria = [];

  // Basic matches
  if (type) matchCriteria.push({ type });

  if (status) {
    if (status === "Overdue") {
      matchCriteria.push({ status: "Ongoing" }); // refine later if you support overdue
    } else {
      matchCriteria.push({ status });
    }
  } else {
    matchCriteria.push({ status: { $in: ["Ended", "Ongoing", "Pending Approval"] } });
  }

  if (userId) {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      matchCriteria.push({ "borrower.id": new ObjectId(userId) });
    } else {
      matchCriteria.push({ "borrower.name": userId });
    }
  }

  if (matchCriteria.length) pipeline.push({ $match: { $and: matchCriteria } });

  // Consistent date for filtering/sorting
  pipeline.push({
    $addFields: {
      _effectiveDate: { $ifNull: ["$date", "$earliestDate"] }
    }
  });

  // Year / month filters (if provided)
  const timeExprs = [];
  if (year)  timeExprs.push({ $eq: [ { $year: "$_effectiveDate" }, year ] });
  if (month) timeExprs.push({ $eq: [ { $month: "$_effectiveDate" }, month ] });
  if (timeExprs.length) pipeline.push({ $match: { $expr: { $and: timeExprs } } });

  // Lookup borrower (keep behavior)
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "borrower.id",
      foreignField: "_id",
      as: "borrowerFullDetails"
    }
  });
  pipeline.push({
    $addFields: {
      borrower: { $ifNull: [ { $arrayElemAt: ["$borrowerFullDetails", 0] }, "$borrower" ] }
    }
  });
  pipeline.push({ $project: { borrowerFullDetails: 0 } });

  // Sort (map "date" to internal field)
  const sortFieldMap = { date: "_effectiveDate" };
  const sortField = sortFieldMap[sortBy] || sortBy;
  pipeline.push({ $sort: { [sortField]: order } });

  // Paginate
  pipeline.push({ $skip: (page - 1) * perPage });
  pipeline.push({ $limit: perPage });

  return DB.query(this.aggregate(pipeline));
};


// --- Models ---
const Loan = mongoose.model('Loan', loanSchema);


// --- Exports ---
export {
  Loan,
};