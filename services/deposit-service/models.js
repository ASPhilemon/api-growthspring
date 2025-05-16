import mongoose from "mongoose";

//schemas
const depositSchema = new mongoose.Schema(
  {}, 
  { timestamps:true }
);

//models
const Deposit  = mongoose.model(
  'deposit',
  depositSchema
);


export { Deposit }