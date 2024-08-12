const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const initiativeSchema = new Schema({
    category: String,
    debt: Number,
    initial_date: Date,
    count_date: Date,
    merchant_code: String,
    personal_code: String,
    initiative_name: String,
    about: String,
    payment_history: Array,
    transactions_history: Array,
    secondary_codes: Array,
    one_time_codes: Array,
    percentage: Number,
    club_contribution_percentage: Number,
})

const Initiatives = mongoose.model('initiatives', initiativeSchema);
module.exports = Initiatives;
