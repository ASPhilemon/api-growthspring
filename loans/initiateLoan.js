
const express = require('express'); 
const moment = require('moment-timezone');
const Loans = require('../Models/loans');
const Users = require('../auth/models/UserModel');
const Constants = require('../Models/constants');
const axios = require('axios');
require('dotenv').config()

const router = express.Router();


/** 
 * @route POST /initiate-request
 * @desc Initiates a loan request, validates the input, fetches user and loan constants,
 * checks the loan limit, and creates a loan record in the database if validation passes.
 * @access Private (Requires authorization token)
 */

router.post('/initiate-request', async (req, res) => {
  try {
    const authorization = req.headers['authorization'];
    let token = authorization.split(' ')[1]; 

    const { loan_amount, loan_duration, earliest_date, latest_date, borrower_name_id } = req.body;


    // Ensure all required fields are provided in the request.
    if (!loan_amount || !loan_duration || !earliest_date || !latest_date) {
      return res.status(400).json({ msg: 'There is an entry missing. Please fill in everything needed', no: 0 });
    }

    const Today = moment().tz('Africa/Nairobi').toDate(); 


    // Fetch the borrower (user) details and constants like lending rate.
    const [member, constants] = await Promise.all([
      Users.findOne({ _id: borrower_name_id }),
      Constants.findOne(),
    ]);

    const api = process.env.maxLoanAmountURL;
    

    // Prepare data to send to the loan limit API, including borrower ID.
    const requestData = {
        borrower_name_id  
    };
    

    // Check the loan limit of the borrower by calling the external API.
    const response = await axios.post(api, requestData, {
        headers: {
            'Authorization': `Bearer ${token}` 
        }
    });
    
    const currentLoanLimit = response.data.loan_limit;
    

    // If the requested loan amount exceeds the current limit, return an error response.
    if (loan_amount > currentLoanLimit) {
      return res.status(400).json({ msg: `The Loan Limit of ${Math.round(currentLoanLimit).toLocaleString('en-US')}, has been exceeded!`, no: 0 });
    }


    // Calculate loan-related details based on constants and loan duration.
    // Wherever 1000 is used, it's because the price of one point is 1000.
    const duration = loan_duration;
    const total_rate = constants.monthly_lending_rate * duration; // Total interest rate over the loan duration.
    const points_needed = (duration / 12) < 1.5 // Is loan period less than 18 months?
      ? Math.max(0, ((total_rate - 12)) / 100) * loan_amount / 1000 // Points calculation for durations shorter than 18 months. Interest is charged for the 1st 6 months, and 3rd 6 months of the loan period.
      : (12 / 100) * loan_amount / 1000 + (duration - 18) * constants.monthly_lending_rate * loan_amount / 100000; // Points calculation for durations between 18 to 24 months. 24 is the Maximum

    // New: Clarifies point and interest assumptions.
    const points_spent = points_needed <= member.points ? points_needed : member.points; // Only spend as many points as the member has. This assumes no installments paid
    const actual_interest = (total_rate / 100) * loan_amount - (points_spent * 1000); // Deduct points from the total interest. This assumes borrower doesn't pay any installment calculated below.
    const installment_amount = Math.round(loan_amount / (1000 * loan_duration)) * 1000; // Principle divided evenly by the loan duration. Interest is not considered here, but attached to the last installment.

 
    // Create a new loan record with all the calculated details, status set to "Pending Approval."
    await Loans.create({
      loan_duration,
      loan_units: 0,
      interest_accrued: 0,
      points_accrued: 0,
      loan_rate: total_rate,
      earliest_date,
      latest_date,
      loan_status: "Pending Approval",
      installment_amount,
      initiated_by: req.user.fullName,
      approved_by: "",
      worth_at_loan: member.investmentAmount,
      loan_amount,
      loan_date: "",
      borrower_name: member.fullName,
      points_spent,
      discount: 0,
      points_worth_bought: 0,
      rate_after_discount: total_rate,
      interest_amount: actual_interest,
      principal_left: loan_amount,
      last_payment_date: Today
    });

    res.status(200).json({ msg: 'Loan request initiated successfully' });
  } catch (error) {
    
    console.error(error);
    res.status(500).json({ msg: `An error occurred: ${error.message}`, no: 0 });
  }
});

module.exports = router; 

