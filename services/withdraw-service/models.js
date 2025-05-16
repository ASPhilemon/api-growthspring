import mongoose from "mongoose";

//schemas
const withdrawSchema = new mongoose.Schema(
  {}, 
  { timestamps:true }
);

//models
const Withdraw  = mongoose.model(
  'withdraw',
  withdrawSchema
);


export { Withdraw }