const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const locationSchema = new Schema({
    name: String,
    amount: Number,
})

const CashLocations = mongoose.model('cashlocation', locationSchema);
module.exports = CashLocations;
