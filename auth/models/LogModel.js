const mongoose = require('mongoose');


const Schema = mongoose.Schema;
const LogSchema = new Schema({
  user: {
    type: String,
    required: true
  },
  page: {
    type: String,
    required: true
  },
}, {timestamps: true})


const LogModel = mongoose.model('log', LogSchema);

module.exports = LogModel