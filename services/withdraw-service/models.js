import mongoose from "mongoose";

const { ObjectId } = mongoose.Types

//schemas
const userSchema = new mongoose.Schema({
  _id : {
    type: ObjectId,
    required: true
  }, 
  fullName : {
    type: String,
    required: true
  }
})

const cashLocationSchema = new mongoose.Schema({
  _id: {
    type: ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
})

const withdrawSchema = new mongoose.Schema(
  {
    withdrawnBy: {
      type: userSchema,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    date:{
      type: Date,
      required: true
    },
    cashLocations: {
      type: [cashLocationSchema],
      required: true
    },
    recordedBy: {
      type: userSchema,
      required: true
    },
  }, 
  { timestamps:true }
);

//models
const Withdraw  = mongoose.model(
  'withdraw',
  withdrawSchema
);


export { Withdraw }