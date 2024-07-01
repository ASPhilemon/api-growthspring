const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const loansSchema = new Schema({
    loan_duration: Number,
    loan_rate: Number,
    earliest_date: Date,
    latest_date: Date,
    loan_status: String,
    initiated_by: String,
    approved_by: String,
    worth_at_loan: Number,
    loan_amount: Number,
    loan_date: Date,
    borrower_name: String,
    points_spent: Number,
    principal_left: Number,
    last_payment_date: Date,
    loan_units: Number,
    rate_after_discount: Number,
    discount: Number,
    points_worth_bought: Number,
    points_accrued: Number,
    interest_accrued: Number,
    interest_amount: Number,
    installment_amount: Number,
    payments: [{
        payment_date: Date,
        payment_amount: Number,
        updated_by: String,
    }],
})

const Loans = mongoose.model('loan', loansSchema);
module.exports = Loans;



