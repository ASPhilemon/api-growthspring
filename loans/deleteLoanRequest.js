const express = require('express');
const Loans = require('../Models/loans');
require('dotenv').config()

const router = express.Router();

// Loan Request Deletion Route
router.post('/remove-loan-request', async (req, res) => {
  try {
    if (req.body.loan_id) {
        // Delete loan request using the loan_id
        await Loans.deleteOne({ _id: req.body.loan_id });  

        res.status(200).json({ msg: 'Loan Request Deleted Successfully' });
    } else {
        // Respond with an error if loan_id is not provided
        res.status(400).json({ msg: "loan_id is required" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: `An error occurred: ${error.message}`});
  }
});

module.exports = router;
