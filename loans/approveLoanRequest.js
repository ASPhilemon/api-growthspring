const express = require('express');
const moment = require('moment-timezone');
const Loans = require('../Models/loans');
const Users = require('../auth/models/UserModel');
const CashLocations = require('../Models/cashlocations');
require('dotenv').config();

const router = express.Router();

/**
 * @route POST /approve-loan-request
 * @description Approves a loan request by:
 * - Validating the selected money sources.
 * - Ensuring the total amount from sources matches the loan amount.
 * - Deducting money from the respective cash locations.
 * - Updating loan status and deducting user points.
 * @param {Object} req - Request object containing loan and source details.
 * @param {Object} res - Response object to send the result of the approval process.
 * @returns {JSON} Response message indicating success or failure.
 */
router.post('/approve-loan-request', async (req, res) => {

    // Set current date using East African Time
    const today = moment().tz('Africa/Nairobi').toDate();
    
    try {
        // Step 1: Validate that sources are provided
        if (!req.body.sources || req.body.sources.length === 0) {
            return res.status(400).json({ msg: 'No sources selected for the loan.' });
        }

        // Step 2: Ensure all source amounts are integers
        req.body.sources.forEach(source => {
            source.amount = parseInt(source.amount, 10);
        });

        // Step 3: Calculate total amount from sources
        const totalFromSources = req.body.sources.reduce((total, source) => total + source.amount, 0);

        // Step 4: Get loan details using loan_id
        const loan = await Loans.findOne({ _id: req.body.loan_id });
        if (!loan) {
            return res.status(404).json({ msg: 'Loan not found.' });
        }

        // Step 5: Ensure the total amount from sources matches the loan amount
        if (totalFromSources !== loan.loan_amount) {
            return res.status(400).json({ msg: 'The total amount from sources does not match the loan amount.' });
        }

        // Step 6: Get available cash locations
        const cashLocations = await CashLocations.find();

        // Step 7: Deduct the specified amounts from the appropriate cash locations
        for (const source of req.body.sources) {
            const location = cashLocations.find(loc => loc.name === source.location);

            // Check if location exists and has enough funds
            if (location && location.amount >= source.amount) {
                // Deduct the specified amount from the location
                await CashLocations.updateOne(
                    { name: location.name },
                    { $inc: { amount: -source.amount } }
                );
            } else {
                // Insufficient funds in the source location
                return res.status(400).json({ msg: `Not enough funds in '${source.location}'` });
            }
        }

        // Step 8: Update loan status and approval details
        await Loans.updateOne(
            { _id: req.body.loan_id },
            {
                $set: {
                    loan_status: 'Ongoing',
                    loan_date: today,
                    approved_by: req.user.fullName
                }
            }
        );

        // Step 9: Deduct points from the borrower to prevent future spending
        await Users.updateOne(
            { fullName: loan.borrower_name },
            { $inc: { points: -loan.points_spent } }
        );

        // Respond with success message
        res.json({ msg: 'Loan approved successfully.' });

    } catch (error) {
        // Catch and log any errors during the loan approval process
        console.error('Error during loan approval:', error);
        res.status(400).json({ msg: 'An error occurred during loan approval.' });
    }
});

/**
 * Module exports the router to be used in the main application.
 */
module.exports = router;
