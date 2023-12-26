const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const creditSchema = new Schema({
    loan_status: String,
    issued_by: String,
    ended_by: String,
    loan_amount: Number,
    loan_date: Date,
    borrower_name: String,
    end_date: Date,
    duration: Number,
    profit: Number,
})

const Credit = mongoose.model('credit', creditSchema);
module.exports = Credit;