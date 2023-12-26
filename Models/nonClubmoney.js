const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const depositSchema = new Schema({
    depositor_name: String,
    deposit_date: Date,
    deposit_amount: Number,
    recorded_by: String,
    return_date: Date,
    status: String,
    sent_by: String,
})

const NonClub = mongoose.model('additional', depositSchema);
module.exports = NonClub;