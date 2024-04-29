const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const constantsSchema = new Schema({
monthly_credit_rate: Number,
max_lending_rate: Number,
min_lending_rate: Number,
annual_tax_rate: Number,
max_credits: Number,
min_discount: Number,
discount_profit_percentage: Number,
min_monthly_rate: Number,
loan_risk: Number,
members_served_percentage: Number,
loan_multiple: Number

});

const Constants = mongoose.model('constant', constantsSchema);
module.exports = Constants;