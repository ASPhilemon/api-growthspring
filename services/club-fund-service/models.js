import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

const clubFundAnnualTransactionSchema = new mongoose.Schema(
  {
    transaction_type: {
      type: String,
      required: true,
      enum: ["Income", "Expense"],
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    account: {
      type: ObjectId,
      required: false,
      ref: "cash-location",
    },
  },
  { timestamps: true }
);

const ClubFundAnnualTransaction = mongoose.model(
  "fundTransaction",
  clubFundAnnualTransactionSchema
);

export { ClubFundAnnualTransaction };
