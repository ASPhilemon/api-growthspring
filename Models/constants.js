const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const constantsSchema = new Schema({
monthly_credit_rate: Number,
max_lending_rate: Number,
min_lending_rate: Number,
annual_tax_rate: Number

});

const Constants = mongoose.model('constant', constantsSchema);
module.exports = Constants;