
const express = require('express'); 
const moment = require('moment-timezone');
const Loans = require('../../../growthspring-backend-main/Models/loans');
const Users = require('../../../growthspring-backend-main/auth/models/UserModel');
const Constants = require('../../../growthspring-backend-main/Models/constants');
const axios = require('axios');
require('dotenv').config()

const router = express.Router();

/**
 * @route POST /make-loan-payment
 * @description Handles loan payment submissions. It updates loan information, interest, and points based on payment details.
 * - Validates input and checks loan existence.
 * - Updates principal left, interest, loan duration, and member points.
 * - If the payment is more than required, excess is considered a deposit.
 * @param {Object} req - Request object containing loan ID, payment amount, payment date, etc.
 * @param {Object} res - Response object to send the result of the payment process.
 * @returns {JSON} Response message indicating success or failure.
 */
router.post('/make-loan-payment', async (req, res) => {
    const Today = moment().tz('Africa/Nairobi').toDate(); // East African Time as a default for payment

    try {
        // Ensure required data is provided
        if (!req.body.payment_amount || !req.body.payment_date) {
            return res.json({ msg: 'Required information is missing. Please provide all information needed.' });
        }

        // Fetch loan data, constants, and member data
        const loan_finding = await Loans.findOne({ _id: req.body.loan_id });
        const constants = await Constants.findOne();
        const member = await Users.findOne({fullName: loan_finding.borrower_name});

        if (!loan_finding) {
            return res.json({ msg: 'Loan not found' });
        }

        // Ensure payment date is after loan date to avoid inconsistencies
        if (new Date(loan_finding.loan_date).getTime() > new Date(req.body.payment_date).getTime()) {
            return res.status(400).json({ msg: "Payment date not correct!" });
        }

        const { payment_date, payment_location, user } = req.body;
        const authorization = req.headers['authorization'];
        let token = authorization.split(' ')[1];
        
        // Calculating remaining principal and other loan attributes
        let paymentAmount = req.body.payment_amount;
        let principal_left = loan_finding.principal_left - paymentAmount;
        let points_balance = 0;
        let points_spent = loan_finding.points_spent; // Get those recorded in the database first
        let loan_duration = loan_finding.loan_duration; // Initial loan duration
        const last_payment_period = getDaysDifference(loan_finding.last_payment_date, req.body.payment_date);//How many days since last payment
        let loan_units = loan_finding.loan_units + loan_finding.principal_left * last_payment_period;//Loan units = loan amount X time

        // Determine how far the payment date is into the next month and adjust loan duration, giving allowance of 7 days
        let remainder = getDaysDifference(loan_finding.loan_date, req.body.payment_date) % 30;
        let current_loan_duration = remainder / 30 < 0.24 
            ? Math.trunc(getDaysDifference(loan_finding.loan_date, req.body.payment_date) / 30)
            : Math.ceil(getDaysDifference(loan_finding.loan_date, req.body.payment_date) / 30);

        // Determine the effect of points on loan interest
        let point_days = Math.max(0, Math.min(12, current_loan_duration) - 6) + Math.max(18, current_loan_duration) - 18;
        let running_rate = constants.monthly_lending_rate * (current_loan_duration - point_days);//Deduct the months covered by points, assuming that cash interest is paid for the 1st 6 months, and 3rd 6 months of the loan period.
        let pending_amount_interest = running_rate * loan_finding.principal_left / 100;//How much does the unpaid principle accrue in interest since loan issuance till now?
        let points = (constants.monthly_lending_rate / 100) * point_days * loan_finding.principal_left / 1000;//What are the actual points spent?
        let payment_interest_amount = 0;  
        let paymentsTotal = 0;
        let calculatedInterest = 0; // Actual interest to be paid by end of loan

        // Iterate over existing payments to calculate interest and points spent if any for previous payments using same logic above
        if (loan_finding.payments) {
            loan_finding.payments.forEach(payment => {
                if (paymentsTotal < loan_finding.loan_amount){ // Get payments for principle only
                    let duration = (getDaysDifference(loan_finding.loan_date, payment.payment_date) % 30) / 30 < 0.24 
                        ? Math.trunc(getDaysDifference(loan_finding.loan_date, payment.payment_date) / 30)
                        : Math.ceil(getDaysDifference(loan_finding.loan_date, payment.payment_date) / 30);
                    
                    let point_day = Math.max(0, Math.min(12, duration) - 6) + Math.max(18, duration) - 18;
                    let payment_interest = constants.monthly_lending_rate * (duration - point_day) * payment.payment_amount / 100;
                    points += constants.monthly_lending_rate * point_day * payment.payment_amount / 100000;
                    payment_interest_amount += payment_interest;
                    paymentsTotal += payment.payment_amount;
                    calculatedInterest += payment_interest;
                } else { // These are payments on interest
                    payment_interest_amount -= payment.payment_amount;
                }
            });
        }

        let msg = '';
        let loan_status = loan_finding.loan_status;

        // Total interest due combining pending interest and accumulated payment interest
        let totalInterestDue = pending_amount_interest + payment_interest_amount;
        let interest_amount = loan_finding.interest_amount; //This is from the database, that assumed no intermitent payments
        let partInterest = 0; // Part of the payment is interest?

        // Handle different scenarios based on payment amount and outstanding balances
        if (paymentAmount < (loan_finding.principal_left + totalInterestDue)) {//Is loan interest and/or principle uncleared?
            if (paymentAmount >= loan_finding.principal_left) {//Only interest uncleared
                principal_left = 0;
                partInterest = loan_finding.principal_left > 0 ? paymentAmount - loan_finding.principal_left : partInterest;
                paymentAmount = loan_finding.principal_left > 0 ? loan_finding.principal_left : paymentAmount;
            }
        } else if (paymentAmount > (loan_finding.principal_left + totalInterestDue)) {//Loan is fully cleared, and excess interest can be recorded as deposit
            principal_left = 0;
            interest_amount = calculatedInterest;
            loan_status = "Ended";
            points_spent = points;
            points_balance = loan_finding.points_spent - points;//How many points are to be restored

            // Handle excess payments by considering them deposits
            const new_deposit = paymentAmount - loan_finding.principal_left - totalInterestDue;
            loan_duration = current_loan_duration;
            let msg1 = "";
            if (new_deposit >= 5000) {
                const source = "Excess Loan Payment";
                const requestData = { member, new_deposit, payment_date, source, payment_location, user };

                const api = process.env.addDepositURL;
                await axios.post(api, requestData, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                msg1 = `A Deposit of ${new_deposit} was recorded. It was excess Payment.`;
            }
            msg = msg1 + `The Loan is now Ended.`;
        } else if (paymentAmount == (loan_finding.principal_left + totalInterestDue)) {
            principal_left = 0;
            interest_amount = calculatedInterest;
            loan_status = "Ended";
            loan_duration = current_loan_duration;
            points_spent = points;
            points_balance = loan_finding.points_spent - points;
            msg = `The Loan is now Ended.`;
        }

        /*/ Update the indicated cash location with the payment amount
        await CashLocations.updateOne(
            { name: paymentAmount },
            { $inc: { "amount": paymentAmount } }
        );*/

        // Prepare the updated loan object
        const updatedLoan = {
            principal_left,
            interest_amount,
            loan_units,
            last_payment_date: req.body.payment_date,
            loan_status,
            loan_duration,
            points_spent
        };

        // Add new payment to the loan's payment history
        loan_finding.payments.push({
            payment_date: req.body.payment_date,
            payment_amount: paymentAmount,
            updated_by: req.user.fullName
        });
        
        // Add separate payment for first partial payment on interest
        if (partInterest > 0){
            loan_finding.payments.push({
                payment_date: req.body.payment_date,
                payment_amount: partInterest,
                updated_by: req.user.fullName
            }); 
        }

        // Save the updated loan with the modified payments array
        updatedLoan.payments = loan_finding.payments;

        await Loans.updateOne({ _id: req.body.loan_id }, { $set: updatedLoan }).then(response => {
            msg += ' Payment was successfully Recorded';
            res.json({ msg, loan_status: loan_status });
        });

        // Update the user's points in case some were used
        await Users.updateOne(
            { fullName: loan_finding.borrower_name },
            { $inc: { "points": points_balance } }
        );

    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: `An error occurred: ${error}` });
    }

    /**
     * @function getDaysDifference
     * @description Calculate the number of days between two dates.
     * @param {Date} earlierDate - The starting date.
     * @param {Date} [laterDate=new Date()] - The end date, defaulting to today.
     * @returns {number} The difference in days between the two dates.
     */
    function getDaysDifference(earlierDate, laterDate = new Date()) {
        const firstPeriod = new Date(earlierDate);
        const secondPeriod = new Date(laterDate);
        const millisecondsPerDay = 1000 * 60 * 60 * 24;
    
        const timeDifference = secondPeriod.getTime() - firstPeriod.getTime();
        const daysApart = Math.floor(timeDifference / millisecondsPerDay);
        
        return daysApart;
    }
});

module.exports = router;
