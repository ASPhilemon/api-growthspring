const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const depositSchema = new Schema({
    depositor_name: String,
    deposit_date: Date,
    deposit_amount: Number,
    recorded_by: String,
    balance_before: Number,
    source: String,
})

const Deposit = mongoose.model('Deposit', depositSchema);
module.exports = Deposit;