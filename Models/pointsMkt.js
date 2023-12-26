const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pointsMktSchema = new Schema({
    seller_name: String,
    points_for_sale: Number,
    added_by: String,
    date_added: Date,
})

const PointsMkt = mongoose.model('pointsMkt', pointsMktSchema);
module.exports = PointsMkt;