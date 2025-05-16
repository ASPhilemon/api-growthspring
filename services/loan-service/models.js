import mongoose from "mongoose";

//schemas
const loanSchema = new mongoose.Schema(
  {}, 
  { timestamps:true }
);

const loanPaymentSchema = new mongoose.Schema(
  {},
  { timestamps:true }
);


//models
const Loan = mongoose.model(
  'loan',
  loanSchema
);

const LoanPayment = mongoose.model(
  'loan-payment',
  loanPaymentSchema
);

export { Loan, LoanPayment }