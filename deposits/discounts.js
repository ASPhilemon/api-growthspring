const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const path = require('path');
const Initiatives = require('../../../growthspring-backend-main/Models/discount_initiatives');
const Users = require('../../../growthspring-backend-main/auth/models/UserModel');
const Constants = require('../../../growthspring-backend-main/Models/constants');
const Codes = require('../../../growthspring-backend-main/Models/codes');
const Discount = require('../../../growthspring-backend-main/Models/discounts');
const sendMail = require('../../../growthspring-backend-main/util/sendMail');

// Discount Calculation and Email Logic
router.post('/get-discount', async (req, res) => {
    const currentDate = moment().tz('Africa/Nairobi').toDate();//Use East African Time

    try {

        // Extract values from the request body
        const { user_code, merchant_code, amount } = req.body;

        // Validate that all required details are provided
        if (!user_code || !merchant_code || !amount) {
            return res.json({ msg: 'Please provide all the details' });
        }

        // Check if the merchant exists by looking up the merchant_code in the database
        const merchant = await Initiatives.findOne({ merchant_code });
        const constants = await Constants.findOne(); // Retrieve constants from the database

        // If the merchant is not found, return an error message
        if (!merchant) {
            return res.json({ 
                msg: `Invalid Merchant Code: <span style="color: blue; font-weight: bold;">${merchant_code}</span>` 
            });
        }

        // Check that the provided amount is positive
        if (amount <= 0) {
            return res.json({ msg: 'Enter Correct Amount' });
        }
                    
        // Function to find a user by their code identifier
        async function getUserByCode(identifier) {
            // Find the code object that matches the provided identifier
            const codeRecord = await Codes.findOne({ secondary_codes_identifier: identifier });
            
            // If a code is found, look up the user associated with the code's primary name
            if (codeRecord) {
                return await Users.findOne({ fullName: codeRecord.primary_name });
            }
            
            // Return null if no code or user is found
            return null;
        }

        // Fetch the user associated with the secondary code identifier
        const user = await getUserByCode(user_code);
        if (!user) {
            return res.status(404).json({ msg: `User not found for code: ${user_code}` });
        }        

        // Calculate the tentative discount amount, rounded down to the nearest thousand
        const tentativeDiscountAmount = Math.trunc((merchant.percentage * amount) / 100000) * 1000;//The discount percentage applied is got from the records corresponding to that particular business/merchant
        
        // Set the final discount amount based on the user's current points. This is because points are spent to get the discount
        const discountAmount = tentativeDiscountAmount < user.points * 1000 
            ? tentativeDiscountAmount 
            : user.points * 1000;
        
        // Calculate points spent based on the discount amount
        const pointsSpent = discountAmount / 1000;// Each point is 1000/=. It can be made a constant

        // Record the discount details in the Discount database
        await Discount.create({
            source: merchant.initiative_name,
            discount_amount: discountAmount,
            date: currentDate,
            beneficiary_name: codeRecord.primary_name,
            percentage: merchant.percentage,//Percentage of discount at this time
        });

        // Deduct points from the user based on the discount used
        await Users.updateOne(
            { _id: user._id },
            { $inc: { points: -pointsSpent } }
        );

        // Update merchant's debt based on the contribution percentage
        const updatedDebt = merchant.debt + (merchant.club_contribution_percentage * amount) / 100;//Depending on the arrangement, this is money either the Club owes the merchant, or what they owe the Club
        const formattedDebt = updatedDebt.toLocaleString('en-US');
        const previousDebt = merchant.debt.toLocaleString('en-US');

        const paymentMessage = `
            You get a Discount of 
            <span style="color: blue; font-weight: bold;">UGX ${Math.round(discountAmount).toLocaleString('en-US')}</span>.
            You can pay a Cash Amount of 
            <span style="color: blue; font-weight: bold;">UGX ${Math.round(amount - discountAmount).toLocaleString('en-US')}</span>.
        `;

        await Initiatives.updateOne(
            { merchant_code: merchant_code },
            { $set: { debt:  updatedDebt}, $push: { transactions_history: { date: currentDate, amount, code: user_code } } }
        );

        const emailContext = {
            discount: discountAmount.toLocaleString('en-US'),
            merchant_name: merchant.initiative_name,
            points_spent: pointsSpent
        };

        await sendMail({//Email to business
            senderName: "accounts",
            recipientEmail: merchant.email,
            emailSubject: "Amount Due",
            emailTemplate: path.join(__dirname, './auth/views/debtView.ejs'),
            replyTo: "blaisemwebe@gmail.com",
            context: { Debt: formattedDebt, previousDebt: previousDebt }
        });

        await sendMail({//Email to Code owner
            senderName: "accounts",
            recipientEmail: user.email,
            emailSubject: "Points Spent",
            emailTemplate: path.join(__dirname, './auth/views/discountpointsView.ejs'),
            replyTo: "blaisemwebe@gmail.com",
            context: emailContext
        });

        res.json({ success: true, msg: paymentMessage });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ msg: 'An error occurred while processing the discount' });
    }
});

module.exports = router;
