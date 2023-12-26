const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transfersSchema = new Schema({
    name: String,
    transaction_date: Date,
    points_worth: Number,
    recorded_by: String,
    points_involved: Number,
    reason: String,
    type: String,
})

const PointsSale = mongoose.model('PointsSale', transfersSchema);
module.exports = PointsSale;