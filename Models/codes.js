const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const codesSchema = new Schema({
    primary_code: String,
    secondary_codes_identifier: String,
    primary_name: String,
})

const Codes = mongoose.model('code', codesSchema);
module.exports = Codes;