import mongoose from "mongoose";

//schemas
const pointTransferSchema = new mongoose.Schema(
  {}, 
  { timestamps:true }
);

//models
const PointTransfer  = mongoose.model(
  'point-transfer',
  pointTransferSchema
);


export { PointTransfer }