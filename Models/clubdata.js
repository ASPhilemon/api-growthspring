const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const clubSchema = new Schema({
cashLocations: [{
    location_name: String,
    location_amount: Number,
    category: String,
}],
pending_profits: [{
    year: String,
    pending_profits_amount: Number
}],
clubFundWorth: Number,
clubExpenses: [{
    expense_name: String,
    expense_amount: Number,
    recorded_by: String,
    date_of_recording: Date,
    status: String
}],
clubInvestments: [{
    investment_name: String,
    investment_amount: Number,
    added_by: String,
    investment_date: Date,
    details: String,
    capitalLeft: Number,
    status: String, 
    paymentsHistory: [{
        date: Date,
        amount: Number,
        recorded_by: String
    }]
}],
});

const ClubData = mongoose.model('clubdata', clubSchema);
module.exports = ClubData;