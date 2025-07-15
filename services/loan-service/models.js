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


// Define a static method for filtered loan retrieval
loanSchema.statics.getFilteredLoans = async function({
  member, 
  year,
  status, 
  page = 1,
  month,
  order = -1, 
  sortBy = "date", 
}) {
  const pipeline = [];
  const matchCriteria = []; // Array to hold individual match conditions

  // --- Match Stage ---
  // Filtering by year
  if (year) {
    matchCriteria.push({ $expr: { $eq: [{ $year: "$date" }, year] } });
  }
  // Filtering by month
  if (month) {
    matchCriteria.push({ $expr: { $eq: [{ $month: "$date" }, month] } });
  }

  if (!status) {
    matchCriteria.push({ status: { $in: ["Ended", "Ongoing"] } });
  } else {
    if (status === "Overdue") {
      matchCriteria.push({ status: "Ongoing" });
    } else {
      matchCriteria.push({ status: status });
    }
  }

  if (member) {
    // Check if 'member' is a valid ObjectId string. If so, filter by ID.
    // Otherwise, assume it's a name and filter by name.
    if (mongoose.Types.ObjectId.isValid(member)) {
      matchCriteria.push({ "borrower.id": new ObjectId(member) });
    } else {
      matchCriteria.push({ "borrower.name": member });
    }
  }

  // Add the combined match criteria to the pipeline if any conditions exist
  if (matchCriteria.length > 0) {
    pipeline.push({ $match: { $and: matchCriteria } });
  }

  // --- Lookup and AddFields for Borrower Details ---
  // This fetches the full user document for the borrower
  pipeline.push({
    $lookup: {
      from: "users", // Name of the users collection
      localField: "borrower.id",
      foreignField: "_id",
      as: "borrowerFullDetails" // Temporary field name
    }
  });
  // Replace the 'borrower' field with the first element of the lookup result
  pipeline.push({
    $addFields: {
      borrower: { $arrayElemAt: ["$borrowerFullDetails", 0] }
    }
  });
  // Project out the temporary lookup field
  pipeline.push({ $project: { borrowerFullDetails: 0 } });

  // --- Sort Stage ---
  // Using dynamic field names based on sortBy and order
  pipeline.push({ $sort: { [sortBy]: order } });

  // --- Pagination Stages ---
  pipeline.push({ $skip: (page - 1) * perPage });
  pipeline.push({ $limit: perPage });

  const loans = await DB.tryMongoose(this.aggregate(pipeline));

  // --- Post-query filter for "Overdue" status ---
  if (status === "Overdue") {
    const currentDate = new Date();

    return loans.filter((loan) => {
      const loanEndDate = new Date(loan.date);
      loanEndDate.setMonth(loanEndDate.getMonth() + loan.duration);

      return loanEndDate < currentDate && loan.status === "Ongoing";
    });
  }

  return loans;
};

// --- Models ---
const Loan = mongoose.model('Loan', loanSchema);


// --- Exports ---
export {
  Loan,
};