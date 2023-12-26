const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cashHistorySchema = new Schema({
    recipient_location_name: String,
    transaction_date: Date,
    transaction_amount: Number,
    recorded_by: String,
    other_location_name: String,
    balance_before: Number,
    category: String,
})

const CashHistory = mongoose.model('cashhistory', cashHistorySchema);
module.exports = CashHistory;