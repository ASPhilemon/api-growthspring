import mongoose from "mongoose";
import * as DB from "../../utils/db-util.js"; 

const { ObjectId } = mongoose.Types;

// --- Loan Schema ---
const loanSchema = new mongoose.Schema({
  duration: { type: Number, required: true },
  rate: { type: Number, required: true },
  earliestDate: { type: Date, required: true },
  latestDate: { type: Date, required: true },
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
  date: { type: Date },
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
  pointsAccrued: { type: Number, default: 0 },
  interestAccrued: { type: Number, default: 0 },
  interestAmount: { type: Number, required: true },
  installmentAmount: { type: Number, required: true },

  sources: [{
    id: { type: ObjectId, required: true, ref: 'CashLocation' }, 
    name: { type: String, required: true }, 
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


loanSchema.statics.getFilteredLoans = async function({
  filter,
  sort = { field: "date", order: -1 }, 
  pagination = { page: 1, perPage: 20 }
}) {
  const pipeline = [];
  const matchCriteria = [];

  // Match stage
  if (filter?.year) matchCriteria.push({ $expr: { $eq: [{ $year: "$date" }, filter.year] } });
  if (filter?.month) matchCriteria.push({ $expr: { $eq: [{ $month: "$date" }, filter.month] } });
  if (filter?.borrowerId) matchCriteria.push({ "borrower.id": new ObjectId(filter.borrowerId) }); 

  if (matchCriteria.length > 0) pipeline.push({ $match: { $and: matchCriteria } });

  // Lookup stage to fetch borrower details
  pipeline.push({
    $lookup: {
      from: "users", 
      localField: "borrower.id",
      foreignField: "_id",
      as: "borrowerDetail"
    }
  });
  pipeline.push({
    $addFields: {
      borrower: { $arrayElemAt: ["$borrowerDetail", 0] } 
    }
  });
  pipeline.push({ $project: { borrowerDetail: 0 } }); 

  // Sort stage
  pipeline.push({ $sort: { [sort.field]: sort.order } });

  // Skip and Limit for pagination
  pipeline.push({ $skip: (pagination.page - 1) * pagination.perPage });
  pipeline.push({ $limit: pagination.perPage });

  return await DB.tryMongoose(this.aggregate(pipeline)); 
};


// --- PointsSale Schema ---
const pointsSaleSchema = new mongoose.Schema({
  entity: { 
    id: { type: ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true }
  },
  date: { type: Date, required: true }, 
  pointsWorth: { type: Number, required: true }, 
  recordedBy: { 
    id: { type: ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true }
  },
  pointsInvolved: { type: Number, required: true }, 
  reason: { type: String, required: true },
  type: { type: String, required: true, enum: ["Spent", "Earned", "Bought", "Sold"] },
}, { timestamps: true });


// --- Models ---
const Loan = mongoose.model('Loan', loanSchema);
const PointsSale = mongoose.model('PointsSale', pointsSaleSchema);


// --- Exports ---
export {
  Loan,
  PointsSale,
};