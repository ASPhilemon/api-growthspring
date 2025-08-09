import mongoose from "mongoose";
import * as DB from "../../utils/db-util.js"

//schemas
const { ObjectId } = mongoose.Types;

const userSchema = new mongoose.Schema({
  _id: {
    type: ObjectId,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  }
});

const pointTransactionSchema = new mongoose.Schema({
    type: {
      type: String,
      enum: ['award', 'redeem', 'transfer'],
      required: true,
    },
    recipient: {
      type: userSchema,
      required: function () {
        return this.type !== 'redeem';
      }
    },
    sender: {
      type: userSchema,
      required: function () {
        return this.type === 'transfer';
      }
    },
    redeemedBy: {
      type: userSchema,
      required: function () {
        return this.type === 'redeem';
      }
    },
    points: {
      type: Number,
      required: true,
      min: 1
    },
    date: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true
    },
    refId:{
      type: String,
      required: function () {
        return this.type != 'transfer';
      }
    }
  }, { timestamps: true }
);

//custom static methods on model
pointTransactionSchema.statics.getTransactions = async function(
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
    if (filter?.type) matchCriteria.push({type: filter.type})
    if (filter?.userId) {
      const userId = ObjectId.createFromHexString(filter.userId)
      matchCriteria.push({$or: [
        {"recipient._id": userId},
        {"sender._id": userId},
        {"redeemedBy._id": userId}
      ]})
    }

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
const PointTransaction  = mongoose.model(
  'point-transaction',
  pointTransactionSchema
);


export { PointTransaction }