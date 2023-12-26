const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const unitsSchema = new Schema({
name: String,    
units: Number,
year: String
});

const InvestmentUnits = mongoose.model('units', unitsSchema);
module.exports = InvestmentUnits;