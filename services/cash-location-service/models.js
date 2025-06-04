import mongoose from "mongoose";

const { ObjectId } = mongoose.Types

//cash-location schema
const cashLocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  amount: {
    type:  Number,
    required: true,
  },
}, { timestamps:true });

//cash-location sub document schema
const subCashLocationSchema = new mongoose.Schema({
  _id : {
    type: ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true,
  }
});

//user sub schema

const subUserScmema = new mongoose.Schema({
  _id: {
    type: ObjectId,
    required: true
  },
  fullName: {
    type: String,
    required: true
  }
})

//cash-location-transfer schema
const cashLocationTransferSchema = new mongoose.Schema({
  source: {
    type: subCashLocationSchema,
    required: true
  },
  dest: {
    type: subCashLocationSchema,
    required: true
  },
  recordedBy : {
    type: subUserScmema,
    required: true
  },
  amount: {
    type:  Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
}, { timestamps:true });

//cash-location model
const CashLocation  = mongoose.model('cash-location', cashLocationSchema);

//cash-location-transfer model
const CashLocationTransfer  = mongoose.model('cash-location-transfer', cashLocationTransferSchema);

export {CashLocation, CashLocationTransfer}