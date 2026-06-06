import mongoose from "mongoose";

const { ObjectId } = mongoose.Types

//Cash-location schema
const cashLocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ["Standard Chartered", "Mobile Money", "Unit Trust"]
  },
  amount: {
    type:  Number,
    required: true,
  },
}, { timestamps:true });

//Cash-location sub document schema
const subCashLocationSchema = new mongoose.Schema({
  _id : {
    type: ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true,
    enum: ["Standard Chartered", "Mobile Money", "Unit Trust"]
  }
});

//Cash-location-transfer schema
const cashLocationTransferSchema = new mongoose.Schema({
  _id: String,
  source: {
    type: subCashLocationSchema,
    required: true
  },
  dest: {
    type: subCashLocationSchema,
    required: true
  },
  amount: {
    type:  Number,
    required: true,
  },
}, { timestamps:true });

//Cash-location model
const CashLocation  = mongoose.model('cash-location', cashLocationSchema);

//Cash-location-transfer model
const CashLocationTransfer  = mongoose.model('cash-location-transfer', cashLocationTransferSchema);

export {CashLocation, CashLocationTransfer}