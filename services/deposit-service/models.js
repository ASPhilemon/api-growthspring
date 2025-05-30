import mongoose from "mongoose";
import * as DB from "../../utils/db-util.js"

const { ObjectId } = mongoose.Types

//schemas
const depositSchema = new mongoose.Schema({
    depositor: {
      type: {
        _id: {
          type: ObjectId,
          required: true
        },
        fullName: {
          type: String,
          required: true
        }
      }
    },
    date: {
      type: Date,
      required: true
    },
    amount:{
      type: Number,
      required: true
    },
    type:{
      type:"String",
      enum: ["Club Saving", "Temporary Saving"],
      required: true
    },

    recordedBy: {
      type: {
        _id: {
          type: ObjectId,
          required: true
        },
        fullName: {
          type: String,
          required: true
        }
      }
    },
    balanceBefore:{
      type: Number,
      min: 0,
      required: true
    },
    source:{
      type: String,
      enum: ["Savings", "Profits", "Excess Loan Payment", "Interest"],
      required: true
    },
    cashLocation:{
      type: {
        _id: {
          type: ObjectId,
          required: true
        },
        name: {
          type: String,
          required: true
        }
      }
    }
  }, { timestamps:true }
);

const yearDepositSchema = new mongoose.Schema({
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
depositSchema.statics.getDeposits = async function({
  filter,
  sort = {field: "date", order: 1},
  pagination = {page: 1, perPage: 20}
}){
    const pipeline = [];

    // match stage
    const matchStage = {};
    const matchCriteria = [];
    if (filter?.year) matchCriteria.push({ $expr: { $eq: [{ $year: "$date" }, filter.year] }});
    if (filter?.month) matchCriteria.push({ $expr: { $eq: [{ $month: "$date" }, filter.month]}});
    if (filter?.userId) matchCriteria.push({ "depositor._id": filter.userId });

    if (matchCriteria.length > 0) matchStage.$and = matchCriteria
    pipeline.push({ $match: matchStage });

    // sort stage
    pipeline.push({ $sort: { [sort.field]: sort.order } });

    // skip and Limit stages for pagination
    pipeline.push({ $skip: (pagination.page - 1) * pagination.perPage });
    pipeline.push({ $limit: pagination.perPage });

    //lookup stage to fetch depositor from users collection
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "depositor._id",
        foreignField: "_id",
        as: "depositor"
      },
    })
    
    //add fields stage to replace depositor single element array with user object in the array
    pipeline.push({
      $addFields: {
        depositor: { $arrayElemAt: ["$depositor", 0] }
      }
    })

    //execute pipeline
    return await DB.query(Deposit.aggregate(pipeline))
}

//models
const Deposit  = mongoose.model('deposit', depositSchema );
const YearDeposit  = mongoose.model('year-deposit', yearDepositSchema );


export { Deposit, YearDeposit }