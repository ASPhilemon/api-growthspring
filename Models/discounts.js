const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const discountSchema = new Schema({
    source: String,
    discount_amount: Number,
    date: Date,
    beneficiary_name: String,
    percentage: Number,
})

const Discount = mongoose.model('discount', discountSchema);
module.exports = Discount;