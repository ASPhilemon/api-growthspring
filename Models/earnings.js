const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const earningsSchema = new Schema({
    beneficiary_name: String,
    date_of_earning: Date,
    earnings_amount: Number,
    destination: String,
    source: String,
    status: String,
})

const Earnings = mongoose.model('Earning', earningsSchema);
module.exports = Earnings;