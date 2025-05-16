import mongoose from "mongoose";

//schemas
const userSchema = new mongoose.Schema(
  {}, 
  { timestamps:true }
);

//models
const User  = mongoose.model(
  'user',
  userSchema
);


export { User }