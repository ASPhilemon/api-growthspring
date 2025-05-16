import mongoose from "mongoose";

//schemas
const cashLocationSchema = new mongoose.Schema(
  {}, 
  { timestamps:true }
);

const cashLocationTransferSchema = new mongoose.Schema(
  {},
  { timestamps:true }
);


//models
const CashLocation  = mongoose.model(
  'cash-location',
  cashLocationSchema
);

const CashLocationTransfer  = mongoose.model(
  'cash-location-transfer',
  cashLocationTransferSchema
);

export { CashLocation, CashLocationTransfer }
