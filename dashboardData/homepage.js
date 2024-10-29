const express = require('express');
const moment = require('moment-timezone');
const Deposit = require('../Models/deposits');
const Loans = require('../Models/loans');
const Constants = require('../Models/constants');
const PointsSale = require('../Models/pointsTransfers');
const Earnings = require('../Models/earnings');
const InvestmentUnits = require('../Models/investment_units');
const Discount = require('../Models/discounts');
const Users = require('../auth/models/UserModel');
const loanAmountRoutes = require('../loans/loanAmount');
const discountRoutes = require('../deposits/discounts');
const axios = require('axios');
require('dotenv').config()

const router = express.Router();

// Route handler for homepage data optimized for performance
router.get('/homepage-data-opt', async (req, res) => { 

    const Today = moment().tz('Africa/Nairobi').toDate(); // Fetches the current date in East African Time
    const thisYear = new Date().getFullYear(); // Gets the current year to compare with data
    const authorization = req.headers['authorization'];
    let token = authorization.split(' ')[1];

    /**
     * Helper function to format date strings into DD/MM/YYYY format.
     * @param {string} dateString - Date in string format.
     * @returns {string} Formatted date in DD/MM/YYYY.
     */
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    };

    /**
     * Helper function to process arrays with a callback, or return a default value.
     * @param {Array} array - The array to be processed.
     * @param {Function} processDataFunc - Function to apply to the array if it's not empty.
     * @param {string} [noDataValue='No Data Available'] - Value to return if array is empty or invalid.
     * @returns {any} Processed array result or the default noDataValue.
     */
    const processArray = (array, processDataFunc, noDataValue = 'No Data Available') => 
        Array.isArray(array) && array.length > 0 ? processDataFunc(array) : noDataValue;

    try {
        let member = req.user;
        if (member.fullName === "Anabelle Joan") {
            // Use Some details of any member for the example dashboard
            member = await Users.findOne({ fullName: 'Omodo Joshua Deo' });
        }

        // Fetch necessary records from the database concurrently for better performance.
        const constantsPromise = Constants.findOne(); // System constants like rates
        const clubPromise = Users.find({}); // All users in the club
        const clubDepositsPromise =  Deposit.find({}); // Club-level deposit records
        const clubEarningsPromise =  Earnings.find({}); // Club-level earnings
        const clubUnitsRecordsPromise =  InvestmentUnits.find({ }); // Club-level investment units
        const memberDepositsPromise = Deposit.find({ depositor_name: member.fullName }); // Member-specific deposits
        const debtsPromise = Loans.find({ borrower_name: member.fullName, loan_status: "Ongoing" }); // Ongoing loans for the member
        const debtHistoryPromise = Loans.find({ borrower_name: member.fullName}); // Full loan history for the member
        const discountsPromise = Discount.find({ beneficiary_name: member.fullName}); // Member-specific discount history
        const earningsPromise = Earnings.find({ beneficiary_name: member.fullName }); // Member-specific earnings
        const pointsPromise = PointsSale.find({ name: member.fullName, type: "Sell"}); // Points sales for the member
        const unitsPromise = InvestmentUnits.find({ name: member.fullName }); // Member-specific investment units
        const allDebtsPromise =  Loans.find({ loan_status: "Ongoing" }); // All ongoing loans across members
         
        let [
          constants, club, clubDeposits, clubEarnings, clubUnitsRecords,
          memberDeposits, debts, debtHistory, discounts, earnings, points, units,
          allDebts
        ] = await Promise.all([
          constantsPromise, clubPromise, clubDepositsPromise, clubEarningsPromise,
          clubUnitsRecordsPromise, memberDepositsPromise, debtsPromise, debtHistoryPromise,
          discountsPromise, earningsPromise, pointsPromise, unitsPromise,
          allDebtsPromise
        ]);
                
        /*
        The sections are presented in this order:
        1. Member Savings Section
           - List of deposits
           - Total savings by the member
           - Years in the Club
        
        2. Member Earnings Section
           - Earnings grouped by year
        
        3. Member Loans Section
           - Total current debt (principal and interest)
           - Amount/Percentage lent to others
           - List of ongoing and completed loans
        
        4. Member Points Section
           - Total points held and their worth
           - List of points spent

        5. Member Discounts Section
           - List of discounts grouped by year

        6. Club Savings Section
           - Total club worth and savings per month

        7. Club Earnings Section
           - Earnings grouped by year
        */
      
        // --- Member Savings Section ---
        
        // Process and sort member deposits to generate records for display.
        const depositsArray = processArray(memberDeposits, (md) => getTotalSumsAndSort(md, 'deposit_date', 'deposit_amount'));
        var memberDepositsRecords = [];
        const sortedDepositYears = depositsArray !== 'No Data Available' 
            ? Object.entries(depositsArray.yearsSums).sort((a, b) => b[0] - a[0]) // Sort deposits by year
            : 'No Data Available';
            
        if (depositsArray !== 'No Data Available') {
            sortedDepositYears.forEach(([year, record]) => {
                let values = processArray(depositsArray.recordsByYear[year], (records) =>
                    records.map(depositRecord => [
                        formatDate(depositRecord.deposit_date),
                        Math.round(depositRecord.deposit_amount),
                        depositRecord.source
                    ])
                );

                // Summarize deposit data for each year
                memberDepositsRecords.push({
                    year,
                    total: Math.round(record.deposit_amount),
                    avgMonthlyDeposit: year !== thisYear 
                        ? Math.round(record.deposit_amount / 12) 
                        : Math.round(record.deposit_amount / (new Date().getMonth() + 1)),
                    values
                });
            });
        }
        
        // Calculate total savings (worth) for the member
        const memberWorth = Math.round(member.investmentAmount);

        // Calculate how many years the member has been in the club, rounded to 1 decimal place.
        const memberYears = member 
            ? Math.round((getDaysDifference(member.membershipDate) / 365) * 10) / 10 
            : 'No Data Available';
            
        // --- Member Earnings Section ---
        
        // Initialize variables for total investment and earnings calculations
        var actualInvestmentTotal = 0;
        var totalReturns = 0; // Total return on investment (ROI) percentage
        var totalEarnings = 0; // Total earnings since joining the club

        const earningsArray = processArray(earnings, (e) => getTotalSumsAndSort(e, 'date_of_earning', 'earnings_amount'));
        var memberEarningsRecords = earningsArray !== 'No Data Available' 
            ? [] 
            : [{year: Today.getFullYear(), total: 0, roi: 0, values: []}];
            
        const sortedEarningsYears = earningsArray !== 'No Data Available' 
            ? Object.entries(earningsArray.yearsSums).sort((a, b) => b[0] - a[0]) 
            : 'No Data Available';

        // Calculate yearly earnings and ROI
        if (earningsArray !== 'No Data Available') {
            sortedEarningsYears.forEach(([year, record]) => {
                units.forEach(entry => {
                    if (entry.year === year) {
                        let actualInvestment = entry.units / 365; // Assuming units are earned daily
                        actualInvestmentTotal += Math.round(actualInvestment);
                        const ROI = year !== thisYear 
                            ? Math.round(record.earnings_amount * 100 / actualInvestment) 
                            : 0;
                        totalReturns += ROI;
                        totalEarnings = year !== thisYear 
                            ? totalEarnings + record.earnings_amount 
                            : totalEarnings;

                        // Generate earnings data per year for display
                        let yearObject = {
                            year: year,
                            total: Math.round(record.earnings_amount),
                            roi: ROI + '%',
                            values: processArray(earningsArray.recordsByYear[year], (earningsRecords) =>
                                earningsRecords.map(earningsRecord => [
                                    formatDate(earningsRecord.date_of_earning),
                                    Math.round(earningsRecord.earnings_amount),
                                    earningsRecord.source,
                                    earningsRecord.destination
                                ])
                            )
                        };
                        memberEarningsRecords.push(yearObject);
                    }
                });
            });
        }

        // --- Member Loans Section ---

        /**
         * Helper function to sum up the total debt amount from loan records.
         * @param {Array} loans - Array of loan records.
         * @returns {number} Total loan amount.
         */

        // Sum the total debt the member has without the interest
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left, 0);

        // Total club worth
        const clubWorth = club.reduce((total, member) => total + member.investmentAmount, 0);
        
        // Current amount and Percentage lent to others
        let usedPool = 0;
        let possibleRate = 12;
        let borrower_name_id = member._id;

        const loanAmountApi = process.env.maxLoanAmountURL;
        const loanLimitApi = process.env.maxLoanLimitURL;      
        const loanLimitRequestData = {member, constants, club, allDebts, debts};
        const loanAmountRequestData = {borrower_name_id};
        
        // Check the currently available loan amount for the borrower by calling the external API.
        const loanAmountResponse = await axios.post(loanAmountApi, loanAmountRequestData, {
            headers: {
                'Authorization': `Bearer ${token}` 
            }
        });

        // Check the loan limit of the borrower by calling the external API.
        const loanLimitResponse = await axios.post(loanLimitApi, loanLimitRequestData, {
            headers: {
                'Authorization': `Bearer ${token}` 
            }
        });

        const maxLimit =  loanLimitResponse.data.max_limit; //Member's Maximum Limit
        const loan_limit = loanAmountResponse.data.loan_limit; // Currently available funds

        for (const clubMember of club) {            
          const memberDebts = allDebts.filter(loan => loan.borrower_name === clubMember.fullName);
          const memberDebtsTotal = memberDebts.reduce((total, loan) => total + loan.principal_left, 0);
          usedPool += Math.max(0, memberDebtsTotal - clubMember.investmentAmount);
        }
        const ratio = (usedPool / (clubWorth + usedPool - totalDebt));
        const riskPercentageOfWorth = totalDebt >= member.investmentAmount ? 0 : ratio * (member.investmentAmount - totalDebt) / member.investmentAmount; 
        const riskOfWorth = riskPercentageOfWorth * member.investmentAmount;

        // Calculate loan details for all ongoing and completed loans
        var memberDebtRecords = [];
        const debtRecords = processArray(debtHistory, (dh) => getTotalSumsAndSort(dh, 'loan_date', 'loan_amount'));
            
        if (debtRecords !== 'No Data Available') {
            Object.entries(debtRecords.recordsByYear).forEach(([year, records]) => {
                records.forEach(record => {                   
                    if (record.loan_status == "Ongoing" || record.loan_status == "Ended") {
                        let paymentHistory = record.payments.map(paymentRecord => [
                            formatDate(paymentRecord.payment_date),
                            Math.round(paymentRecord.payment_amount)
                        ]);
                        let laterDate = record.loan_status == "Ended" ? record.last_payment_date : Today;
                        let interest_accrued = 0;
                        let points_accrued =  0;
                            if (record.loan_status == "Ongoing") {
                                // Determine how far the payment date is into the next month and adjust loan duration, giving allowance of 7 days
                                let remainder = getDaysDifference(record.loan_date, Today) % 30;
                                let current_loan_duration = remainder / 30 < 0.24 
                                    ? Math.trunc(getDaysDifference(loan_finding.loan_date, req.body.payment_date) / 30)
                                    : Math.ceil(getDaysDifference(loan_finding.loan_date, req.body.payment_date) / 30);
                                let point_days = Math.max(0, Math.min(12, current_loan_duration) - 6) + Math.max(18, current_loan_duration) - 18;
                                let running_rate = constants.monthly_lending_rate * (current_loan_duration - point_days);
                                let pending_amount_interest = running_rate * record.principal_left / 100;
                                let payment_interest_amount = 0;
                                let points = constants.monthly_lending_rate * point_days * record.principal_left / 100000;
                                let paymentsTotal = 0;

                                if (record.payments) {
                                    record.payments.forEach(payment => {
                                        if (paymentsTotal < loan_finding.loan_amount){ // Get payments for principle only
                                            let duration = (getDaysDifference(record.loan_date, payment.payment_date) % 30) / 30 < 0.24 
                                            ? Math.trunc(getDaysDifference(record.loan_date, payment.payment_date) / 30)
                                            : Math.ceil(getDaysDifference(record.loan_date, payment.payment_date) / 30);
                                            let point_day = Math.max(0, Math.min(12, duration) - 6) + Math.max(18, duration) - 18;         
                                            let payment_interest = constants.monthly_lending_rate * (duration - point_day) * payment.payment_amount / 100;
                                            points += constants.monthly_lending_rate * point_day * payment.payment_amount / 100000;
                                            payment_interest_amount += payment_interest;
                                        } else { // These are payments on interest
                                            payment_interest_amount -= payment.payment_amount;
                                        }    
                                    })
                                }
        
                                interest_accrued = pending_amount_interest + payment_interest_amount;
                                points_accrued = points;                                
                        }
                        
        
                        let yearObject = {
                            loanId: record._id,
                            issueDate: formatDate(record.loan_date),
                            loanAmount: record.loan_amount,
                            amountLeft: Math.max(0, Math.round(record.loan_amount - record.payments.reduce((total, loan) => total + loan.payment_amount, 0))),
                            agreedLoanDuration: Math.round(record.loan_duration) + ' months (' + getDaysDifference(record.loan_date, laterDate) + ' Days Elasped)',
                            annualInterestRate: record.loan_rate + '%',
                            pointsSpent: Math.round(record.points_spent),
                            interest_accrued: interest_accrued,
                            points_accrued: points_accrued,
                            loan_status: record.loan_status,
                            paymentHistory: paymentHistory
                        };
        
                        memberDebtRecords.push(yearObject);
                    }

                });
            
            });
            
        } 
       
        // --- Member Points Section ---
        
        //Total number and worth of Points
        const one_point_value = 1000;
        const memberPoints = Math.round(member.points);
        const pointsWorth = Math.round(one_point_value * memberPoints);
        const pointsArray = processArray(points, (p) => getTotalSumsAndSort(p, 'transaction_date', 'points_involved'));
        
        var pointsRecords = pointsArray !== 'No Data Available' 
        ? [] : [{year: Today.getFullYear(), total: 0, values: []}];
        
        const sortedPoints = pointsArray !== 'No Data Available' 
        ? Object.entries(pointsArray.yearsSums).sort((a, b) => b[0] - a[0]) 
        
        : 'No Data Available';
        
        // List of Points Spent 
        if (pointsArray !== 'No Data Available') {
            sortedPoints.forEach(([year, record]) => {
                let values = pointsArray.recordsByYear[year].map(pointsRecord => [
                    formatDate(pointsRecord.transaction_date),
                    Math.round(pointsRecord.points_involved),
                    pointsRecord.reason
                ]);
    
                let yearObject = {
                    year: year,
                    total: Math.round(record.points_involved),
                    values: values
                };
    
                pointsRecords.push(yearObject);
            });
        }

        // --- Member Discounts Section ---
        
        // Process and sort discount history for the member
        
        const discountArray = processArray(discounts, (u) => getTotalSumsAndSort(u, 'date', 'discount_amount'));
        const sorteddiscountArray = discounts 
        ? Object.entries(discountArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) 
        : 'No Data Available';

        const currentUnitsSum = units.reduce((total, unit) => total + unit.units, 0) 
        + member.investmentAmount * getDaysDifference(member.investmentDate);
        const credits = Math.round(currentUnitsSum * 100/15000000)/100;
       
        var discountPercentage = credits > constants.max_credits 
        ? 100 : Math.round(credits * 100/constants.max_credits);
        discountPercentage = Math.max(discountPercentage, constants.min_discount);

        //List of discounts got grouped by year
        var memberDiscountRecords = [];      

              if (discounts) {
                sorteddiscountArray.forEach(([year, record]) => {
                    let values = processArray(discountArray.recordsByYear[year], (records) =>
                        records.map(discountRecord => [formatDate(discountRecord.date),
                        Math.round(discountRecord.discount_amount),
                        discountRecord.source]));
      
                    memberDiscountRecords.push({
                        year,
                        total: Math.round(record.discount_amount),
                        values
                    });
                });
            }

        // --- Club Savings Section ---
        
        /**
         * Helper function to calculate total savings for the club.
         * @param {Array} deposits - Array of all club deposit records.
         * @returns {number} Total savings for the club.
         */

        const currentYear = new Date().getFullYear().toString(); 
        
        //Total savings per month   
        const clubDepositsArray = processArray(clubDeposits, (cd) => getTotalSumsAndSort(cd, 'deposit_date', 'deposit_amount'));
        const clubUnits = processArray(clubUnitsRecords, (u) => getTotalSumsAndSort(u, 'year', 'units'));
        const sortedClubDepositYears = clubDepositsArray !== 'No Data Available' 
        ? Object.entries(clubDepositsArray.yearsSums).sort((a, b) => b[0] - a[0]) 
        : 'No Data Available';
   
        var clubDepositsRecords = [];
        if (clubDepositsArray !== 'No Data Available') {
            sortedClubDepositYears.forEach(([year, record]) => {
                let values = Object.entries(clubDepositsArray.monthlySums[year]).map(([month, mRecord]) => [
                    month, 
                    Math.round(mRecord.deposit_amount)
                ]);

                let yearObject = {
                    year: year,
                    total: Math.round(record.deposit_amount),
                    avgMonthyDeposit: year !== currentYear 
                    ? Math.round(record.deposit_amount / 12) 
                    : Math.round(record.deposit_amount / (new Date().getMonth() + 1)),
                    values: values
                };

                clubDepositsRecords.push(yearObject);                
            });
        }

        // --- Club Earnings Section ---
        
        /**
         * Helper function to calculate total earnings for the club.
         * @param {Array} earnings - Array of all club earnings records.
         * @returns {number} Total earnings for the club.
         */

        // Group club earnings by year 
        const clubEarningsArray = processArray(clubEarnings, (ce) => getTotalSumsAndSort(ce, 'date_of_earning', 'earnings_amount'));
        const sortedClubEarningsYears = clubEarningsArray !== 'No Data Available' ? Object.entries(clubEarningsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
       
        var clubEarningsRecords = [];
        if (clubEarningsArray !== 'No Data Available' && clubUnits !== 'No Data Available') {
            sortedClubEarningsYears.forEach(([year1, record]) => {
                Object.entries(clubUnits.yearsSums).forEach(([year2, record2]) => {
                    if (year2 === year1) {
                        const actualInvestment = record2.units / 365;
                        const year = year1;
                        const total = Math.round(record.earnings_amount);
                        const roi = year !== currentYear ? Math.round(record.earnings_amount * 100 / actualInvestment) : 0;
                        let value = [year, total, roi];

                        clubEarningsRecords.push(value);
                    }
                });
            });
        }

        // Construct the JSON response
        let memberDashboardData = {
            user: member,  // User data from the database
            summary: {// Values to be displayed on top of Home Pages
                memberDeposits: {
                    yourWorth: memberWorth,  // Total member worth based on deposits
                },
                payments: {
                    avgYearlyReturn: Math.round(totalReturns * 100 / memberYears) / 100 + '% Over ' + Math.round(memberYears) + ' years',  // Average yearly return
                },
                loans: {
                    currentDebt: Math.round(totalDebt),  // Current debt for the member
                },
                points: {
                    points: memberPoints,  // Member's points
                },
                credits: {
                    yourCredits: credits,  // Total credits available to the member
                    yourDiscount: discountPercentage + '% of',  // Discount percentage
                },
                clubDeposits: {
                    clubWorth: Math.round(clubWorth),  // Total worth of club deposits
                },
                clubEarnings: {
                    clubWorth: Math.round(clubWorth),  
                },
            },
            home: {
                clubWorth: Math.round(clubWorth),  // Total club worth
                members: club.length - 2,  // Total number of members in the club minus admin and system members
                thisYearDeposits: clubDepositsArray.yearsSums[thisYear] ? clubDepositsArray.yearsSums[thisYear].deposit_amount : 0,  // Deposits for the current year
                yourWorth: memberWorth,  // Member's total worth
                risk: Math.round(riskPercentageOfWorth * 10000) / 100 + '%',  // Risk percentage of member's worth
                riskAmount: Math.round(riskOfWorth / 1000) * 1000,  // Rounded risk amount of the worth
                thisYearSavings: depositsArray.yearsSums?.[thisYear] ? depositsArray.yearsSums[thisYear].deposit_amount : 0,  // Total savings for the current year
                yourDebt: totalDebt,  // Total debt of the member
                bestRate: possibleRate + '%',  // Possible best loan rate
                maxLoanLimit: Math.round(maxLimit),  // Maximum loan limit for the member
                LoanLimit: Math.round(loan_limit),  // Loan limit (current max a member can borrow)
                points: Math.round(member.points),  // Member's current points
                pointsWorth: Math.round(pointsWorth),  // Total worth of member's points
                pointWorth: Math.round(one_point_value),  // Value of a single point
            },
            memberDeposits: memberDepositsRecords,  // Detailed deposit records for the member
            payments: memberEarningsRecords,  // Member's earnings records
            loans: memberDebtRecords,  // Member's debt/loan records
            points: pointsRecords,  // Member's points history
            clubDeposits: clubDepositsRecords,  // Club-wide deposit records
            clubEarnings: clubEarningsRecords,  // Club-wide earnings records
            discounts: memberDiscountRecords  // Member's discount history
        };

        //Modify the response for the sample dashboard
        if (req.user.fullName === "Anabelle Joan") {
            let user = req.user;
            memberDashboardData = {
                ...memberDashboardData,
                user,
            }

            res.json(memberDashboardData);
        } else {
        // Send the constructed JSON response to the client
        res.json(memberDashboardData);
        }
    } catch (error) {
        // Log the error to the console for debugging
        console.error(error);

        // Return a generic error message with a 500 status code
        return res.status(500).json({
            msg: 'An error occurred while processing the request. Please try again later.',
            errorDetails: error.message  // Optional: include the error details for further debugging
        });
    }
    
        
});

//GET_DIFFERENCE_BETWEEN_DATES
function getDaysDifference(earlierDate, laterDate = new Date()) {
    const firstPeriod = new Date(earlierDate);
    const secondPeriod = new Date(laterDate);
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const timeDifference = secondPeriod.getTime() - firstPeriod.getTime();
    const daysApart = Math.floor(timeDifference / millisecondsPerDay);
    
    return daysApart;
}

//GET_TOTALS_FROM_RECORDS
function getTotalSumsAndSort(records, givenDate, ...fields) {
    if (records.length > 0) {
    const totalSumAll = {};
    const yearsSums = {};
    const recordsByYear = {};
    const monthlySums = {};
    const sortedRecords = records.sort((a, b) => new Date(b[givenDate]) - new Date(a[givenDate]));

    sortedRecords.forEach(record => {
        fields.forEach(field => {
            if (!totalSumAll[field]) {
                totalSumAll[field] = 0;
            }
            totalSumAll[field] += record[field];

            const year = new Date(record[givenDate]).getFullYear();
            const month = new Date(record[givenDate]).getMonth();
            const monthName = new Date(record[givenDate]).toLocaleString('default', { month: 'long' });

            if (!yearsSums[year]) {
                yearsSums[year] = {};
            }
            if (!yearsSums[year][field]) {
                yearsSums[year][field] = 0;
            }
            yearsSums[year][field] += record[field];

            if (!recordsByYear[year]) {
                recordsByYear[year] = [];
            }
            recordsByYear[year].push(record);

            if (!monthlySums[year]) {
                monthlySums[year] = {};
            }
            if (!monthlySums[year][monthName]) {
                monthlySums[year][monthName] = {};
            }
            if (!monthlySums[year][monthName][field]) {
                monthlySums[year][monthName][field] = 0;
            }
            monthlySums[year][monthName][field] += record[field];
        });
    });

    // Filtering months where at least one parameter has a non-zero sum
    for (const year in monthlySums) {
        for (const month in monthlySums[year]) {
            let hasNonZeroValue = false;
            for (const field in monthlySums[year][month]) {
                if (monthlySums[year][month][field] !== 0) {
                    hasNonZeroValue = true;
                    break;
                }
            }
            if (!hasNonZeroValue) {
                delete monthlySums[year][month];
            }
        }
    }

    return {
        totalSumAll,
        yearsSums,
        recordsByYear,
        monthlySums,
        sortedRecords,
    };
}

//ADD_DEPOSITS_TO_CUMMULATIVE_UNITS
async function getTotalAmountAndUnits(member, memberDeposits) {
    try {

        const startDate = new Date(member.investmentDate);
        const depositRecords = memberDeposits.filter((deposit)=> deposit.deposit_date >= startDate)
        let totalUnits = 0;
        let totalDeposits = 0;
        for (const deposit of depositRecords) {
            totalUnits += deposit.deposit_amount * getDaysDifference(deposit.deposit_date);
            totalDeposits += deposit.deposit_amount;
        }

        // Calculate total units
        totalUnits += (member.investmentAmount - totalDeposits) * getDaysDifference(member.investmentDate);

        return { totalUnits};
    } catch (error) {
        console.error('Error in getTotalAmountAndUnits:', error);
        throw error;
    }
}

}

module.exports = router;
