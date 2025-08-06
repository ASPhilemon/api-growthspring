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
pointTransactionSchema.statics.getTransactions = async function({
  filter,
  sort = {field: "createdAt", order: -1},
  pagination = {page: 1, perPage: 20}
}){
    const pipeline = [];

    // match stage
    const matchStage = {};
    const matchCriteria = [];
    if (filter?.recipientId) matchCriteria.push({ "recipient._id": filter.recipientId });
    if (filter?.senderId) matchCriteria.push({ "sender._id": filter.senderId });
    if (filter?.redeemedById) matchCriteria.push({ "redeemedBy._id": new filter.redeemedById});
    if (filter?.type) matchCriteria.push({ "type": filter.type });

    if (matchCriteria.length > 0) matchStage.$and = matchCriteria
    pipeline.push({ $match: matchStage });

    // sort stage
    pipeline.push({ $sort: { [sort.field]: sort.order } });

    // skip and Limit stages for pagination
    pipeline.push({ $skip: (pagination.page - 1) * pagination.perPage });
    pipeline.push({ $limit: pagination.perPage });

    //execute pipeline
    return await DB.query(this.aggregate(pipeline))
}

//models
const PointTransaction  = mongoose.model(
  'point-transaction',
  pointTransactionSchema
);


export { PointTransaction }