//Page_requests
//Home_page_fetch
//Admin_page_fetch
//Constants

//Create_new_account
//Add_money_Location
//Add_new_expense
//Add_new_investment
//Transfer_money_between_Locations
//Distribute_profits

//Deposit_initalisation
//Non_club_money

//Short_term_Loans_initalisation
//End_Ongoing_Short_loan

//Add_to_points_market
//Remove_points_sale
//Get_discount_codes
//make_discount_payment

//Loan_Rate_and_request_initiation
//Delete_Request 
//Buy_Discount
//Add_non_club_money
//Approve_loan_requests
//Remove_loan_requests
//End_Ongoing_loan
//Make_Loan_Payments

//FUNCTIONS
//GET_DIFFERENCE_BETWEEN_DATES
//DEPOSIT_FUNCTION
//GET_TOTALS_FROM_RECORDS
//GET_DURATION_AND_PROFIT_OF_SHORT_LOANS
//GET_VALUE_OF_POINTS
//UPDATED_POINTS_MARKET_ARRAY
//UPDATE_CASH_LOCATIONS
//ADD_PENDING_PROFITS


const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const Deposit = require('./Models/deposits');
const NonClub = require('./Models/nonClubmoney');
const ClubData = require('./Models/clubdata');
const Loans = require('./Models/loans');
const Credit = require('./Models/credit');
const Constants = require('./Models/constants');
const PointsSale = require('./Models/pointsTransfers');
const PointsMkt = require('./Models/pointsMkt');
const Earnings = require('./Models/earnings');
const CashHistory = require('./Models/cashTransactionsHistory');
const InvestmentUnits = require('./Models/investment_units');
const Discount = require('./Models/discounts');
const Users = require('./auth/models/UserModel');
const CashLocations = require('./Models/cashlocations');
const Codes =  require('./Models/codes');
const Initiatives =  require('./Models/discount_initiatives');
//const LogModel = require('./auth/models/LogModel');

//auth imports
const {requireAuth, requireAdmin} = require('./auth/middleware')
const authRoutes = require('./auth/routes')

require('dotenv').config()

//express app
const app = express();

app.use(cors({origin: true , credentials: true}))

//["https://growthspringers.com", "https://www.growthspringers.com", "https://admin.growthspringers.com"]

// Use the express.json() middleware to parse JSON data
app.use(express.json());
app.use(cookieParser())

//connect to mongoDB
const dbURI = process.env.dbURI || 'mongodb+srv://blaise1:blaise119976@cluster0.nmt34.mongodb.net/GrowthSpringNew?retryWrites=true&w=majority';
//'mongodb+srv://blaise1:blaise119976@cluster0.nmt34.mongodb.net/GrowthSpringNew?retryWrites=true&w=majority';


mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async (result) => {

    try {
      app.listen(4000);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Error retrieving documents:', error);
    }
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });



//register view engine
app.set('view engine', 'ejs');

//middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

//auth routes
app.use('/auth', authRoutes)


//#constants
//CONSTANTS FOR BACKEND
//Time (EAT)

let Toda = '';
let Today = '';
let thisYear = '';
let thisMonth = '';

function date(){
Toda = moment().tz('Africa/Nairobi').format();
Today = new Date(Toda);
//console.log(Today);
thisYear = new Date().getFullYear();
thisMonth = new Date().toLocaleString('default', { month: 'long' });
}
// POST endpoint to get discount
//make_discount_payment
app.post('/get-discount', async (req, res) => {
    
    try {
        // Validate request body
        const { user_code, merchant_code, amount } = req.body;
        if (!user_code || !merchant_code || !amount) {
            return res.json({ msg: 'Please provide all details' });
        }

        // Check if merchant exists
        const merchant = await Initiatives.findOne({ merchant_code });
        const constants = await Constants.findOne();
        if (!merchant) {
            return res.json({ msg: `Invalid Merchant Code: <span style="color: blue; font-weight: bold;">${merchant_code} </span>` });
        }

        //check if user is authorized
        if (merchant.personal_code != user_code && merchant.category == "Personal") {
            return res.json({ msg: `User Code <span style="color: blue; font-weight: bold;">${merchant_code} </span>is not Authorized`});
        }

        //check that the amount is not negative
        if (req.body.amount <= 0 ) {
            return res.json({ msg: 'Enter Correct Amount'});
        }

        //check that the amount is right
        if (merchant.debt < req.body.amount && merchant.category == "Personal") {
            return res.json({ msg: 'Maximum Acceptable Amount is: <span style="color: red; font-weight: bold;">UGX ' + Math.round(merchant.debt).toLocaleString('en-US') + '</span>'});
        }

        //function to calculate discount
        async function getDiscountRate(user) {
            const units = await InvestmentUnits.find({ name: user.fullName });
            const currentUnitsSum = units.reduce((total, unit) => total + unit.units, 0) + user.investmentAmount * getDaysDifference(user.investmentDate);
            const credits = Math.round(currentUnitsSum * 100/15000000)/100;
            var discountPercentage = credits > constants.max_credits ? 100 : Math.round(credits * 100/constants.max_credits);
            discountPercentage = Math.max(discountPercentage, constants.min_discount);
            return discountPercentage
        }
        
        // Function to get user by code
        async function getUserByCode(identifier) {
            const code = await Codes.findOne({ secondary_codes_identifier: identifier });
            if (code) {
                return await Users.findOne({ fullName: code.primary_name });
            }
            return null;
        }

        // Function to generate message for general category merchant
        function generateMessageForGeneralMerchant(discount_amount, amount) {
            const cashToPay = amount - discount_amount;
            return `You get a discount of <span style="color: gold; font-weight: bold;">UGX ${Math.round(discount_amount).toLocaleString('en-US')}</span>. You can Pay Cash of <span style="color: gold; font-weight: bold;">UGX ${Math.round(cashToPay).toLocaleString('en-US')}</span>`;
        }

        // Function to apply discount for secondary or one-time code user
        async function applyDiscountForSecondaryOrOneTimeCodeUser(user, merchant, earnings) {

            // Register earning for primary user
            await Earnings.create({
                beneficiary_name: user.fullName,
                date_of_earning: new Date(),
                destination: 'Withdrawn',
                earnings_amount: earnings,
                source: merchant.initiative_name,
                status: 'Not-Sent'
            });
        }

        //calculate remaining amount for individual initiatives
        var debt = merchant.debt - req.body.amount;
        var msg = 'Amount Left is: <span style="color: gold; font-weight: bold;">UGX ' + Math.round(debt).toLocaleString('en-US')+ '</span>';

        // Apply discount based on user code length
        if (user_code.length === 4) {
            const code = await Codes.findOne({primary_code: req.body.user_code});
            if (!code) {
                return res.json({ msg: `Invalid User Code: <span style="color: blue; font-weight: bold;">${user_code}</span>` });
            }

            if (merchant.category == "General") {
                const user = await getUserByCode(code.secondary_codes_identifier);
                const discount_rate = await getDiscountRate(user);
                const discount_amount = Math.floor(merchant.percentage * discount_rate * amount / (500 * 10000)) * 500;
                await Discount.create(
                    {
                        source: merchant.initiative_name,
                        discount_amount: discount_amount,
                        date: Today,
                        beneficiary_name: code.primary_name,
                        percentage: discount_rate,
                    }
                );
                debt = merchant.debt;
                msg = generateMessageForGeneralMerchant(discount_amount, amount);
            }
        } else if (user_code.length === 5 || user_code.length === 6) {   
            const checkCode1 = merchant.secondary_codes.find(codes => codes.code === req.body.user_code);
            const checkCode2 = merchant.one_time_codes.find(codes => codes.code === req.body.user_code);
            const verifiedCode = !checkCode1 ? checkCode2 : checkCode1;
            
            if (!verifiedCode) {
                return res.json({ msg: `Invalid User Code: <span style="color: blue; font-weight: bold;">${user_code}</span>` });                
            }

            if (verifiedCode.limit != 'None' && req.body.amount > verifiedCode.limit) {
                return res.json({ msg: 'Spend Limit of <span style="color: red; font-weight: bold;">' + Math.round(verifiedCode.limit).toLocaleString('en-US') + "</span> Exceeded. Please reduce amount"});
            }

            // Apply discount for secondary or one-time code user
            if (merchant.category == "General") {
            const identifier = user_code.substring(0, 2);
            const user = await getUserByCode(identifier);
            const discount_rate = await getDiscountRate(user);
            const full_discount = discount_rate * merchant.percentage * req.body.amount/10000;
            const discount_amount =  Math.floor(full_discount * (100 - constants.discount_profit_percentage) / (500 * 100)) * 500; 
            const earnings = full_discount * constants.discount_profit_percentage / 100;
            await applyDiscountForSecondaryOrOneTimeCodeUser(user, merchant, earnings);
            debt = merchant.debt;
            msg = generateMessageForGeneralMerchant(discount_amount, amount);
            }

            if (checkCode2) {            
                // Delete used code
                await Initiatives.updateOne(
                    { merchant_code: merchant.merchant_code },
                    { $pull: { "one_time_codes": { code: user_code } } }
                );                
            }
        } else {
            return res.json({ msg: `Invalid User Code: <span style="color: blue; font-weight: bold;">${user_code}</span>` });
        }

        // Update transaction history and debt
        merchant.transactions_history.push({ date: new Date(), amount, code: user_code });
        await Initiatives.updateOne(
            { merchant_code: merchant.merchant_code },
            { $set: { debt: debt, transactions_history: merchant.transactions_history } }
        );        

        // Send response
        res.json({ msg : msg });
    } catch (error) {
        console.error('Error:', error);
        res.json({ msg: 'An error occurred' });
    }
});

//Auntenticated Routes below (Logged in members)
app.use(requireAuth)


//Logger
app.post('/log', async (req, res)=>{
    const log = await LogModel.create({page: req.body.page, user: req.user.fullName})
    return res.json({success: true})
})


//COMFIRMATION BOXES FOR ALL SERIOUS BUTTONS

/*
app.get('/homepage-data', async (req, res) => {

    // Helper function for date formatting
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    };

    // Helper function for processing arrays
    const processArray = (array, processDataFunc, noDataValue = 'No Data Available') => 
        Array.isArray(array) && array.length > 0 ? processDataFunc(array) : noDataValue;

try {
    const constants = await Constants.findOne();
    const currentYear = new Date().getFullYear().toString();   
    var club = await Users.find({});
    const clubWorth = club.reduce((total, member) => total + member.investmentAmount, 0);
    const clubDeposits = await Deposit.find({});
    const clubEarnings = await Earnings.find({});
    const clubUnitsRecords = await InvestmentUnits.find({ });
    const clubDepositsArray = processArray(clubDeposits, (cd) => getTotalSumsAndSort(cd, 'deposit_date', 'deposit_amount'));
    const clubEarningsArray = processArray(clubEarnings, (ce) => getTotalSumsAndSort(ce, 'date_of_earning', 'earnings_amount'));
    /*club.forEach(uer => {
        let pw = uer.points * 8 * 50 * uer.investmentAmount / (100000 * 12 * 500)+500;
        console.log(uer.fullName, pw);
    });
    
    const clubUnits = processArray(clubUnitsRecords, (u) => getTotalSumsAndSort(u, 'year', 'units'));
    const sortedClubDepositYears = clubDepositsArray !== 'No Data Available' ? Object.entries(clubDepositsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
    const sortedClubEarningsYears = clubEarningsArray !== 'No Data Available' ? Object.entries(clubEarningsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
    var club_Deposits = club_deposits();
    var club_Earnings = club_earnings();

    if (req.user.fullName === "Anabelle Joan") {
        const one_point_value = 1000;//constants.one_point_value;
        const pointsWorth = Math.round(one_point_value * req.user.points);

        let memberDashboardData = {
            user: req.user,
            summary: {
                memberDeposits: {
                    yourWorth: 1000000,
                },
                payments: {
                    avgYearlyReturn: 13 + '% Over 4 years',
                },
                loans: {
                    currentDebt: 500000,
                },
                points: {
                    points: Math.round(req.user.points),
                },
                credits: {
                    yourCredits: 15,
                    yourDiscount: 70 + '% of'
                },
                clubDeposits: {
                    clubWorth: Math.round(clubWorth),
                },
                clubEarnings: {
                    clubWorth: Math.round(clubWorth),
                },
            },
            home: {
                clubWorth: Math.round(clubWorth),
                members: club.length-2, 
                thisYearDeposits:  clubDepositsArray.yearsSums[thisYear] ? clubDepositsArray.yearsSums[thisYear].deposit_amount : 0,
                yourWorth: 1000000,
                risk: '20%',
                riskAmount: 200000,
                riskAmountOfSavings:100000,
                riskPercentageOfSavings: '%',
                thisYearSavings: 120000,
                yourDebt: 500000,
                bestRate: '12%',
                maxLoanLimit: 5000000,
                points: Math.round(req.user.points),
                pointsWorth: Math.round(pointsWorth),
                pointWorth: Math.round(one_point_value),
            },
            memberDeposits: [{
                year:'2023',
                total: 500000,
                avgMonthyDeposit: 50000,
                values:['21/04/2023', 500000, 'Savings']
            }],
            payments: [{
                "year": "2023",
                "total": 19000,
                "roi": "6%",
                "values": [
                    [
                        "29/12/2023",
                        19000,
                        "Distribution",
                        "Re-Invested"
                    ]
                ]
            }],
            loans: [{
                "loanId": "65577040207f25b1fd2034ba",
                "issueDate": "13/7/2023",
                "loanAmount": 800000,
                "amountLeft": 0,
                "agreedLoanDuration": "2 months",
                "annualInterestRate": 15,
                "pointsSpent": 96,
                "status": "Ended",
                "paymentHistory": [
                    [
                        "30/9/2023",
                        820000
                    ]
                ]
            }],
            points: [        {
                "year": 2024,
                "total": 0,
                "values": []
            }],
            clubDeposits: club_Deposits,//await club_deposits(),
            clubEarnings: club_Earnings,//await club_earnings(),
            discounts: [        {
                "year": "2024",
                "total": 2050,
                "values": [
                    [
                        "8/2/2024",
                        2050,
                        "Angella's Boutique"
                    ]
                ]
            }]
        };
        
        return res.json(memberDashboardData);
    }

    
        // Fetch data from the database
        const memberDeposits = await Deposit.find({ depositor_name: req.user.fullName });
        const debts = await Loans.find({ borrower_name: req.user.fullName, loan_status: "Ongoing" });
        const debtHistory = await Loans.find({ borrower_name: req.user.fullName});
        const discounts = await Discount.find({ beneficiary_name: req.user.fullName});
        const earnings = await Earnings.find({ beneficiary_name: req.user.fullName });
        const points = await PointsSale.find({ name: req.user.fullName, type: "Sell"});
        const units = await InvestmentUnits.find({ name: req.user.fullName });
        const currentUnits = (await getTotalAmountAndUnits(req.user)).totalUnits;
        var actualInvestmentTotal = 0;
        

        // Process and calculate various metrics
        const depositsArray = processArray(memberDeposits, (md) => getTotalSumsAndSort(md, 'deposit_date', 'deposit_amount'));
        const earningsArray = processArray(earnings, (e) => getTotalSumsAndSort(e, 'date_of_earning', 'earnings_amount'));
        const debtRecords = processArray(debtHistory, (dh) => getTotalSumsAndSort(dh, 'loan_date', 'loan_amount'));
        const pointsArray = processArray(points, (p) => getTotalSumsAndSort(p, 'transaction_date', 'points_involved'));
        const discountArray = processArray(discounts, (u) => getTotalSumsAndSort(u, 'date', 'discount_amount'));
        const memberYears = req.user ? Math.round((getDaysDifference(req.user.membershipDate) / 365) * 10) / 10 : 'No Data Available';
        
        const one_point_value = 1000;//constants.one_point_value;
        const pointsWorth = Math.round(one_point_value * req.user.points);
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);
        const possiblePoints = (req.user.points  / 25);
        let possibleRate = 12;//Math.max(constants.min_lending_rate, Math.min(constants.max_lending_rate, Math.round(((20 - possiblePoints) * 0.4 + 12) * 100) / 100));
        
        const currentUnitsSum = units.reduce((total, unit) => total + unit.units, 0) + req.user.investmentAmount * getDaysDifference(req.user.investmentDate);
        const credits = Math.round(currentUnitsSum * 100/15000000)/100;
        var discountPercentage = credits > constants.max_credits ? 100 : Math.round(credits * 100/constants.max_credits);
        discountPercentage = Math.max(discountPercentage, constants.min_discount);

        const sortedDepositYears = depositsArray !== 'No Data Available' ? Object.entries(depositsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedEarningsYears = earningsArray !== 'No Data Available' ? Object.entries(earningsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedPoints = pointsArray !== 'No Data Available' ? Object.entries(pointsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sorteddiscountArray = discounts ? Object.entries(discountArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const maxLimit = await getLoanLimit(req.user);

        // Calculate used pool
        let usedPool = 0;
        const allDebts = await Loans.find({ loan_status: "Ongoing" });
        const allDebt = allDebts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);
        for (const clubMember of club) {
            const member = await Users.findOne({ fullName: clubMember.fullName });
            const memberDebts = allDebts.filter(loan => loan.borrower_name === clubMember.fullName);
            const memberDebtsTotal = memberDebts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);
            usedPool += Math.max(0, memberDebtsTotal - member.investmentAmount);
        }
        //const maxLimit = await getLoanLimit(req.user) - ((req.user.investmentAmount / clubWorth) * usedPool);
        const riskPercentageOfWorth = totalDebt >= req.user.investmentAmount ? 0 : (usedPool / (clubWorth + usedPool - allDebt)) * (req.user.investmentAmount - totalDebt) / req.user.investmentAmount;//usedPool / clubWorth 
        const riskOfWorth = riskPercentageOfWorth * req.user.investmentAmount;
        var memberDepositsRecords = [];
        var memberEarningsRecords = earningsArray !== 'No Data Available' ? [] : [{year: Today.getFullYear(), total: 0, roi: 0, values: []}];
        var memberDebtRecords = [];
        var memberDiscountRecords = []; 
        var pointsRecords = pointsArray !== 'No Data Available' ? [] : [{year: Today.getFullYear(), total: 0, values: []}];

        // Process and structure member deposits records
        if (depositsArray !== 'No Data Available') {
            sortedDepositYears.forEach(([year, record]) => {
                let values = processArray(depositsArray.recordsByYear[year], (records) =>
                    records.map(depositRecord => [formatDate(depositRecord.deposit_date),
                    Math.round(depositRecord.deposit_amount),
                    depositRecord.source]));

                memberDepositsRecords.push({
                    year,
                    total: Math.round(record.deposit_amount),
                    avgMonthyDeposit: year !== currentYear ? Math.round(record.deposit_amount / 12) : Math.round(record.deposit_amount / (new Date().getMonth() + 1)),
                    values
                });
            });
        }

        // Process and structure member discounts records
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

        // Process and structure member earnings records
        var totalReturns = 0;
        var totalEarnings = 0;
        if (earningsArray !== 'No Data Available') {
            sortedEarningsYears.forEach(([year, record]) => {
                units.forEach(entry => {
                    if (entry.year === year) {
                        let actualInvestment = entry.units / 365;
                        actualInvestmentTotal += Math.round(actualInvestment);
                        const ROI = year !== currentYear ? Math.round(record.earnings_amount * 100 / actualInvestment) : 0;
                        totalReturns+= ROI;
                        totalEarnings = year !== currentYear ? totalEarnings + record.earnings_amount : totalEarnings;
                        let yearObject = {
                            year: year,
                            total: Math.round(record.earnings_amount),
                            roi: ROI + '%',
                            values: processArray(earningsArray.recordsByYear[year], (earningsRecords) =>
                                earningsRecords.map(earningsRecord => [formatDate(earningsRecord.date_of_earning),
                                Math.round(earningsRecord.earnings_amount),
                                earningsRecord.source,
                                earningsRecord.destination]))
                        };
                        memberEarningsRecords.push(yearObject);
                    }
                });
            });
        }
        const riskOfSavings = riskOfWorth - totalEarnings;
        const riskPercentageOfSavings = riskOfSavings / (req.user.investmentAmount - totalEarnings);
        // Process and structure member debt records
        let loan = processLoan();
        async function processLoan(){
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
                            let remainder = getDaysDifference(record.loan_date, Today);
                            let current_loan_duration = Math.ceil(remainder / 30);
                            let point_days = Math.max(0, Math.min(12, current_loan_duration) - 6) + Math.max(18, current_loan_duration) - 18;
                            let running_rate = constants.monthly_lending_rate * (current_loan_duration - point_days);
                            let pending_amount_interest = running_rate * record.principal_left / 100;
                            let payment_interest_amount = 0;
                            let points = constants.monthly_lending_rate * point_days * record.principal_left / 100000;

                            if (record.payments) {
                                record.payments.forEach(payment => {
                                    let duration = (getDaysDifference(record.loan_date, payment.payment_date) % 30) / 30 < 0.24 ? Math.trunc(getDaysDifference(record.loan_date, payment.payment_date) / 30): Math.ceil(getDaysDifference(record.loan_date, payment.payment_date) / 30);
                                    let point_day = Math.max(0, Math.min(12, duration) - 6) + Math.max(18, duration) - 18;         
                                    let payment_interest = constants.monthly_lending_rate * (duration - point_day) * payment.payment_amount / 100;
                                    points += constants.monthly_lending_rate * point_day * payment.payment_amount / 100000;
                                    payment_interest_amount += payment_interest;
                                })
                            }

                            interest_accrued = pending_amount_interest + payment_interest_amount;
                            points_accrued = points;
                            //console.log(current_loan_duration, interest_accrued, point_days, points);
                         
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
    }
        // Process and structure club deposits records
     function club_deposits(){        
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
                        avgMonthyDeposit: year !== currentYear ? Math.round(record.deposit_amount / 12) : Math.round(record.deposit_amount / (new Date().getMonth() + 1)),
                        values: values
                    };
    
                    clubDepositsRecords.push(yearObject);
                });
            }
            return clubDepositsRecords
        }

        // Process and structure club earnings records
         function club_earnings(){
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
            return clubEarningsRecords
        }

        // Process and structure points records
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


        
        // Construct the JSON response
        let memberDashboardData = {
            user: req.user,
            summary: {
                memberDeposits: {
                    yourWorth: Math.round(req.user.investmentAmount),
                },
                payments: {
                    avgYearlyReturn: Math.round(totalReturns * 100/memberYears)/100 + '% Over ' + Math.round(memberYears) + ' years',
                },
                loans: {
                    currentDebt: Math.round(totalDebt),
                },
                points: {
                    points: Math.round(req.user.points),
                },
                credits: {
                    yourCredits: credits,//new addition
                    yourDiscount: discountPercentage + '% of'
                },
                clubDeposits: {
                    clubWorth: Math.round(clubWorth),
                },
                clubEarnings: {
                    clubWorth: Math.round(clubWorth),
                },
            },
            home: {
                clubWorth: Math.round(clubWorth),
                members: club.length-2, 
                thisYearDeposits:  clubDepositsArray.yearsSums[thisYear] ? clubDepositsArray.yearsSums[thisYear].deposit_amount : 0,
                yourWorth: Math.round(req.user.investmentAmount),
                risk: Math.round(riskPercentageOfWorth * 10000)/100 + '%',
                riskAmount: Math.round(riskOfWorth/1000) * 1000,
                riskAmountOfSavings:Math.round(riskOfSavings/1000) * 1000,
                riskPercentageOfSavings: Math.round(riskPercentageOfSavings * 10000)/100 + '%',
                thisYearSavings: depositsArray.yearsSums?.[thisYear] ? depositsArray.yearsSums[thisYear].deposit_amount : 0,
                yourDebt: totalDebt,
                bestRate: possibleRate + '%',
                maxLoanLimit: Math.round(maxLimit),
                points: Math.round(req.user.points),
                pointsWorth: Math.round(pointsWorth),
                pointWorth: Math.round(one_point_value),
            },
            memberDeposits: memberDepositsRecords,
            payments: memberEarningsRecords,
            loans: memberDebtRecords,
            points: pointsRecords,
            clubDeposits: club_Deposits,
            clubEarnings: club_Earnings,
            discounts: memberDiscountRecords//new addition
        };
        
        res.json(memberDashboardData);
                  
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: 'An error occurred' });
    }
     
});*/

//Home_page_fetch optimized
app.get('/homepage-data-opt', async (req, res) => {
    let date = date();
    // Helper function for date formatting
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    };
  
    // Helper function for processing arrays
    const processArray = (array, processDataFunc, noDataValue = 'No Data Available') => 
        Array.isArray(array) && array.length > 0 ? processDataFunc(array) : noDataValue;
  
  try {
    const constantsPromise = Constants.findOne();
    var clubPromise = Users.find({});
    const clubDepositsPromise =  Deposit.find({});
    const clubEarningsPromise =  Earnings.find({});
    const clubUnitsRecordsPromise =  InvestmentUnits.find({ });
    const memberDepositsPromise = Deposit.find({ depositor_name: req.user.fullName });
    const debtsPromise = Loans.find({ borrower_name: req.user.fullName, loan_status: "Ongoing" });
    const debtHistoryPromise = Loans.find({ borrower_name: req.user.fullName});
    const discountsPromise = Discount.find({ beneficiary_name: req.user.fullName});
    const earningsPromise = Earnings.find({ beneficiary_name: req.user.fullName });
    const pointsPromise = PointsSale.find({ name: req.user.fullName, type: "Sell"});
    const unitsPromise = InvestmentUnits.find({ name: req.user.fullName });
    let currentUnitsPromise = getTotalAmountAndUnits(req.user)
    const maxLimitPromise =  getLoanLimit(req.user);
    const allDebtsPromise =  Loans.find({ loan_status: "Ongoing" });
    const memberPromise = Users.findOne({ fullName: req.user.fullName });
    const loan_limitPromise = getLoanAmount(req.user); 
  
    let [
      constants,
      club,
      clubDeposits,
      clubEarnings,
      clubUnitsRecords,
      memberDeposits,
      debts,
      debtHistory,
      discounts,
      earnings,
      points,
      units,
      currentUnits,
      maxLimit,
      allDebts,
      member,
      loan_limit
    ] = await Promise.all([
      constantsPromise, clubPromise, clubDepositsPromise, clubEarningsPromise,
      clubUnitsRecordsPromise, memberDepositsPromise, debtsPromise, debtHistoryPromise,
      discountsPromise, earningsPromise, pointsPromise, unitsPromise,
      currentUnitsPromise, maxLimitPromise, allDebtsPromise, memberPromise, loan_limitPromise
      ])
  
    currentUnits = currentUnits.totalUnits
    
  
    const clubWorth = club.reduce((total, member) => total + member.investmentAmount, 0);
    const currentYear = new Date().getFullYear().toString();  
    const clubDepositsArray = processArray(clubDeposits, (cd) => getTotalSumsAndSort(cd, 'deposit_date', 'deposit_amount'));
    const clubEarningsArray = processArray(clubEarnings, (ce) => getTotalSumsAndSort(ce, 'date_of_earning', 'earnings_amount'));
    /*club.forEach(uer => {
        let pw = uer.points * 8 * 50 * uer.investmentAmount / (100000 * 12 * 500)+500;
        console.log(uer.fullName, pw);
    });*/
    
    const clubUnits = processArray(clubUnitsRecords, (u) => getTotalSumsAndSort(u, 'year', 'units'));
    const sortedClubDepositYears = clubDepositsArray !== 'No Data Available' ? Object.entries(clubDepositsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
    const sortedClubEarningsYears = clubEarningsArray !== 'No Data Available' ? Object.entries(clubEarningsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
    var club_Deposits = club_deposits();
    var club_Earnings = club_earnings();
  
    if (req.user.fullName === "Anabelle Joan") {
        const one_point_value = 1000;//constants.one_point_value;
        const pointsWorth = Math.round(one_point_value * req.user.points);
  
        let memberDashboardData = {
            user: req.user,
            summary: {
                memberDeposits: {
                    yourWorth: 1000000,
                },
                payments: {
                    avgYearlyReturn: 13 + '% Over 4 years',
                },
                loans: {
                    currentDebt: 500000,
                },
                points: {
                    points: Math.round(req.user.points),
                },
                credits: {
                    yourCredits: 15,
                    yourDiscount: 70 + '% of'
                },
                clubDeposits: {
                    clubWorth: Math.round(clubWorth),
                },
                clubEarnings: {
                    clubWorth: Math.round(clubWorth),
                },
            },
            home: {
                clubWorth: Math.round(clubWorth),
                members: club.length-2, 
                thisYearDeposits:  clubDepositsArray.yearsSums[thisYear] ? clubDepositsArray.yearsSums[thisYear].deposit_amount : 0,
                yourWorth: 1000000,
                risk: '20%',
                riskAmount: 200000,
                riskAmountOfSavings:100000,
                riskPercentageOfSavings: '%',
                thisYearSavings: 120000,
                yourDebt: 500000,
                bestRate: '12%',
                maxLoanLimit: 5000000,
                points: Math.round(req.user.points),
                pointsWorth: Math.round(pointsWorth),
                pointWorth: Math.round(one_point_value),
            },
            memberDeposits: [{
                year:'2023',
                total: 500000,
                avgMonthyDeposit: 50000,
                values:['21/04/2023', 500000, 'Savings']
            }],
            payments: [{
                "year": "2023",
                "total": 19000,
                "roi": "6%",
                "values": [
                    [
                        "29/12/2023",
                        19000,
                        "Distribution",
                        "Re-Invested"
                    ]
                ]
            }],
            loans: [{
                "loanId": "65577040207f25b1fd2034ba",
                "issueDate": "13/7/2023",
                "loanAmount": 800000,
                "amountLeft": 0,
                "agreedLoanDuration": "2 months",
                "annualInterestRate": 15,
                "pointsSpent": 96,
                "status": "Ended",
                "paymentHistory": [
                    [
                        "30/9/2023",
                        820000
                    ]
                ]
            }],
            points: [        {
                "year": 2024,
                "total": 0,
                "values": []
            }],
            clubDeposits: club_Deposits,
            clubEarnings: club_Earnings,
            discounts: [        {
                "year": "2024",
                "total": 2050,
                "values": [
                    [
                        "8/2/2024",
                        2050,
                        "Angella's Boutique"
                    ]
                ]
            }]
        };
        
        return res.json(memberDashboardData);
    }
  
    
     
        var actualInvestmentTotal = 0;
  
        // Process and calculate various metrics
        const depositsArray = processArray(memberDeposits, (md) => getTotalSumsAndSort(md, 'deposit_date', 'deposit_amount'));
        const earningsArray = processArray(earnings, (e) => getTotalSumsAndSort(e, 'date_of_earning', 'earnings_amount'));
        const debtRecords = processArray(debtHistory, (dh) => getTotalSumsAndSort(dh, 'loan_date', 'loan_amount'));
        const pointsArray = processArray(points, (p) => getTotalSumsAndSort(p, 'transaction_date', 'points_involved'));
        const discountArray = processArray(discounts, (u) => getTotalSumsAndSort(u, 'date', 'discount_amount'));
        const memberYears = req.user ? Math.round((getDaysDifference(req.user.membershipDate) / 365) * 10) / 10 : 'No Data Available';
        
        const one_point_value = 1000;//constants.one_point_value;
        const pointsWorth = Math.round(one_point_value * req.user.points);
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left, 0);
        
        let possibleRate = 12;//Math.max(constants.min_lending_rate, Math.min(constants.max_lending_rate, Math.round(((20 - possiblePoints) * 0.4 + 12) * 100) / 100));
        
        const currentUnitsSum = units.reduce((total, unit) => total + unit.units, 0) + req.user.investmentAmount * getDaysDifference(req.user.investmentDate);
        const credits = Math.round(currentUnitsSum * 100/15000000)/100;
        var discountPercentage = credits > constants.max_credits ? 100 : Math.round(credits * 100/constants.max_credits);
        discountPercentage = Math.max(discountPercentage, constants.min_discount);
  
        const sortedDepositYears = depositsArray !== 'No Data Available' ? Object.entries(depositsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedEarningsYears = earningsArray !== 'No Data Available' ? Object.entries(earningsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedPoints = pointsArray !== 'No Data Available' ? Object.entries(pointsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sorteddiscountArray = discounts ? Object.entries(discountArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';
       
  
        // Calculate used pool
        let usedPool = 0;
     
        const allDebt = allDebts.reduce((total, loan) => total + loan.principal_left, 0);
        
        for (const clubMember of club) {
          
            const memberDebts = allDebts.filter(loan => loan.borrower_name === clubMember.fullName);
            const memberDebtsTotal = memberDebts.reduce((total, loan) => total + loan.principal_left, 0);
            usedPool += Math.max(0, memberDebtsTotal - clubMember.investmentAmount);
        }
        const ratio = (usedPool / (clubWorth + usedPool - allDebt));
        const riskPercentageOfWorth = totalDebt >= req.user.investmentAmount ? 0 : ratio * (req.user.investmentAmount - totalDebt) / req.user.investmentAmount;//usedPool / clubWorth 
        const riskOfWorth = riskPercentageOfWorth * req.user.investmentAmount;
        var memberDepositsRecords = [];
        var memberEarningsRecords = earningsArray !== 'No Data Available' ? [] : [{year: Today.getFullYear(), total: 0, roi: 0, values: []}];
        var memberDebtRecords = [];
        var memberDiscountRecords = []; 
        var pointsRecords = pointsArray !== 'No Data Available' ? [] : [{year: Today.getFullYear(), total: 0, values: []}];
        //console.log(usedPool, allDebt, totalDebt, clubWorth, ratio, riskPercentageOfWorth);
        // Process and structure member deposits records
        if (depositsArray !== 'No Data Available') {
            sortedDepositYears.forEach(([year, record]) => {
                let values = processArray(depositsArray.recordsByYear[year], (records) =>
                    records.map(depositRecord => [formatDate(depositRecord.deposit_date),
                    Math.round(depositRecord.deposit_amount),
                    depositRecord.source]));
  
                memberDepositsRecords.push({
                    year,
                    total: Math.round(record.deposit_amount),
                    avgMonthyDeposit: year !== currentYear ? Math.round(record.deposit_amount / 12) : Math.round(record.deposit_amount / (new Date().getMonth() + 1)),
                    values
                });
            });
        }
  
        // Process and structure member discounts records
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
  
        // Process and structure member earnings records
        var totalReturns = 0;
        var totalEarnings = 0;
        if (earningsArray !== 'No Data Available') {
            sortedEarningsYears.forEach(([year, record]) => {
                units.forEach(entry => {
                    if (entry.year === year) {
                        let actualInvestment = entry.units / 365;
                        actualInvestmentTotal += Math.round(actualInvestment);
                        const ROI = year !== currentYear ? Math.round(record.earnings_amount * 100 / actualInvestment) : 0;
                        totalReturns+= ROI;
                        totalEarnings = year !== currentYear ? totalEarnings + record.earnings_amount : totalEarnings;
                        let yearObject = {
                            year: year,
                            total: Math.round(record.earnings_amount),
                            roi: ROI + '%',
                            values: processArray(earningsArray.recordsByYear[year], (earningsRecords) =>
                                earningsRecords.map(earningsRecord => [formatDate(earningsRecord.date_of_earning),
                                Math.round(earningsRecord.earnings_amount),
                                earningsRecord.source,
                                earningsRecord.destination]))
                        };
                        memberEarningsRecords.push(yearObject);
                    }
                });
            });
        }
        const riskOfSavings = riskOfWorth - totalEarnings;
        const riskPercentageOfSavings = riskOfSavings / (req.user.investmentAmount - totalEarnings);
        // Process and structure member debt records
        let loan = processLoan();
        async function processLoan(){
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
                            let remainder = getDaysDifference(record.loan_date, Today);
                            let current_loan_duration = Math.ceil(remainder / 30);
                            let point_days = Math.max(0, Math.min(12, current_loan_duration) - 6) + Math.max(18, current_loan_duration) - 18;
                            let running_rate = constants.monthly_lending_rate * (current_loan_duration - point_days);
                            let pending_amount_interest = running_rate * record.principal_left / 100;
                            let payment_interest_amount = 0;
                            let points = constants.monthly_lending_rate * point_days * record.principal_left / 100000;
  
                            if (record.payments) {
                                record.payments.forEach(payment => {
                                    let duration = (getDaysDifference(record.loan_date, payment.payment_date) % 30) / 30 < 0.24 ? Math.trunc(getDaysDifference(record.loan_date, payment.payment_date) / 30): Math.ceil(getDaysDifference(record.loan_date, payment.payment_date) / 30);
                                    let point_day = Math.max(0, Math.min(12, duration) - 6) + Math.max(18, duration) - 18;         
                                    let payment_interest = constants.monthly_lending_rate * (duration - point_day) * payment.payment_amount / 100;
                                    points += constants.monthly_lending_rate * point_day * payment.payment_amount / 100000;
                                    payment_interest_amount += payment_interest;
                                })
                            }
  
                            interest_accrued = pending_amount_interest + payment_interest_amount;
                            points_accrued = points;
                            //console.log(current_loan_duration, interest_accrued, point_days, points);
                         
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
    }
        // Process and structure club deposits records
     function club_deposits(){        
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
                        avgMonthyDeposit: year !== currentYear ? Math.round(record.deposit_amount / 12) : Math.round(record.deposit_amount / (new Date().getMonth() + 1)),
                        values: values
                    };
    
                    clubDepositsRecords.push(yearObject);
                });
            }
            return clubDepositsRecords
        }
  
        // Process and structure club earnings records
         function club_earnings(){
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
            return clubEarningsRecords
        }
  
        // Process and structure points records
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
  
  
        
        // Construct the JSON response
        let memberDashboardData = {
            user: req.user,
            summary: {
                memberDeposits: {
                    yourWorth: Math.round(req.user.investmentAmount),
                },
                payments: {
                    avgYearlyReturn: Math.round(totalReturns * 100/memberYears)/100 + '% Over ' + Math.round(memberYears) + ' years',
                },
                loans: {
                    currentDebt: Math.round(totalDebt),
                },
                points: {
                    points: Math.round(req.user.points),
                },
                credits: {
                    yourCredits: credits,//new addition
                    yourDiscount: discountPercentage + '% of'
                },
                clubDeposits: {
                    clubWorth: Math.round(clubWorth),
                },
                clubEarnings: {
                    clubWorth: Math.round(clubWorth),
                },
            },
            home: {
                clubWorth: Math.round(clubWorth),
                members: club.length-2, 
                thisYearDeposits:  clubDepositsArray.yearsSums[thisYear] ? clubDepositsArray.yearsSums[thisYear].deposit_amount : 0,
                yourWorth: Math.round(req.user.investmentAmount),
                risk: Math.round(riskPercentageOfWorth * 10000)/100 + '%',
                riskAmount: Math.round(riskOfWorth/1000) * 1000,
                riskAmountOfSavings:Math.round(riskOfSavings/1000) * 1000,
                riskPercentageOfSavings: Math.round(riskPercentageOfSavings * 10000)/100 + '%',
                thisYearSavings: depositsArray.yearsSums?.[thisYear] ? depositsArray.yearsSums[thisYear].deposit_amount : 0,
                yourDebt: totalDebt,
                bestRate: possibleRate + '%',
                maxLoanLimit: Math.round(maxLimit),
                LoanLimit: Math.round(loan_limit),
                points: Math.round(req.user.points),
                pointsWorth: Math.round(pointsWorth),
                pointWorth: Math.round(one_point_value),
            },
            memberDeposits: memberDepositsRecords,
            payments: memberEarningsRecords,
            loans: memberDebtRecords,
            points: pointsRecords,
            clubDeposits: club_Deposits,
            clubEarnings: club_Earnings,
            discounts: memberDiscountRecords//new addition
        };
        
        res.json(memberDashboardData);
                  
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: 'An error occurred' });
    }
     
  });

//Admin actions only below
app.use(requireAdmin)

//Page_requests
//Get member's list
app.get('/members', (req, res) => {
    Users.find().then(result => {        
        res.json({list: result});
    });
});

//Get locations list
app.get('/locations-list', (req, res) => {
    ClubData.findOne().then(result => {        
        res.json({list: result.cashLocations});
    });
});

//Admin_page_fetch
app.get('/adminpage-data', async (req, res) => {
    // Helper function for date formatting
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    // Helper function for processing arrays
    const processArray = (array, processDataFunc, noDataValue = 'No Data Available') => 
        Array.isArray(array) && array.length > 0 ? processDataFunc(array) : noDataValue;

    try {
        // Fetch data from the database
        var memberData = await Users.find({ });
        const memberDeposits = await Deposit.find({});
        const debts = await Loans.find({ loan_status: "Ongoing" });
        const debtHistory = await Loans.find({ });
        const pastDebts = await Loans.find({ loan_status: "Ended" });
        const credit = await Credit.find({ loan_status: "Ongoing" });
        const creditHistory = await Credit.find({ });
        const pastCredit = await Credit.find({ loan_status: "Ended" });
        const earnings = await Earnings.find({ });
        const clubEarnings = await Earnings.find({beneficiary_name: "Club Fund" });
        const loanRequests = await Loans.find({ loan_status: "Initiation" });
        const clubDebts = await Loans.find({ borrower_name: "Club Fund", loan_status: "Ongoing" });
        const clubOldDebts = await Loans.find({ borrower_name: "Club Fund", loan_status: "Ended" });
        const transferObligations = await NonClub.find({status: "Not-Sent" });
        const pointsSold = await PointsSale.find({reason: "Sell" });
        const pointsMarket = await PointsMkt.find({});
        const clubData = await ClubData.findOne();

        const pendingLoanRequests = groupAndSortEntries(loanRequests, 'latest_date');
        const pendingTransferObligations = groupAndSortEntries(transferObligations, 'return_date');

        const shortTermLoansLocation = clubData.cashLocations.find(location => location.location_name == 'Short Term Loans');
        const pastInvestments = clubData.clubInvestments.find(investment => investment.status == 'Ended');
        const ongoingInvestments = clubData.clubInvestments.find(investment => investment.status == 'Ongoing');
        const shortTermLoansCapital = shortTermLoansLocation ? shortTermLoansLocation.location_amount : 0;

        const currentInvestments = clubData.clubInvestments.filter(investment => investment.status === 'Ongoing');

        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left, 0);
        const totalNonClubMoney = transferObligations.reduce((total, money) => total + money.deposit_amount, 0);
        const totalCredit = creditHistory.reduce((total, loan) => total + loan.loan_amount, 0);
        const currentInvestmentsTotal = currentInvestments.reduce((total, investment) => total + investment.capitalLeft, 0);
        const totalCreditProfit = pastCredit.reduce((total, loan) => total + loan.profit, 0);
        const totalDebts = debtHistory.reduce((total, loan) => total + loan.loan_amount, 0);
        const pointsWorthSold = pointsSold.reduce((total, record) => total + record.points_worth, 0);
        const totalClubOldDebts = clubOldDebts.reduce((total, loan) => total + loan.loan_amount, 0);
        const totalClubDebts = clubDebts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);
        const totalMoney = clubData.cashLocations.reduce((total, location) => total + location.location_amount, 0);

        const depositsArray = processArray(memberDeposits, (md) => getTotalSumsAndSort(md, 'deposit_date', 'deposit_amount'));
        const creditArray = processArray(pastCredit, (md) => getTotalSumsAndSort(md, 'loan_date', 'loan_amount', 'profit'));
        const expensesArray = processArray(clubData.clubExpenses, (ms) => getTotalSumsAndSort(ms, 'date_of_recording', 'expense_amount'));
        const pastInvestmentsArray = processArray(pastInvestments, (ms) => getTotalSumsAndSort(ms, 'investment_date', 'investment_amount'));
        const ongoingInvestmentsArray = processArray(ongoingInvestments, (ms) => getTotalSumsAndSort(ms, 'investment_date', 'investment_amount'));
        const debtRecords = processArray(pastDebts, (dh) => getTotalSumsAndSort(dh, 'loan_date', 'loan_amount'));
        const pointsSoldArray = processArray(pointsSold, (md) => getTotalSumsAndSort(md, 'transaction_date', 'points_worth'));
        const incomeRecords = processArray(clubEarnings, (md) => getTotalSumsAndSort(md, 'date_of_earning', 'earnings_amount'));

        const thisMonthSavings = depositsArray?.monthlySums?.[thisYear]?.[thisMonth]?.deposit_amount || 0;
        const sortedDepositYears = depositsArray !== 'No Data Available' ? Object.entries(depositsArray.yearsSums).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedExpenseYears = expensesArray ? Object.entries(expensesArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]): 'No Data Available';
        const sortedpastInvestments = pastInvestmentsArray ? Object.entries(pastInvestmentsArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedongoingInvestments = ongoingInvestmentsArray ? Object.entries(ongoingInvestmentsArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedDebts = debtRecords ? Object.entries(debtRecords.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedCredit = creditArray ? Object.entries(creditArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedPointsSold = pointsSoldArray ? Object.entries(pointsSoldArray.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';
        const sortedIncomeRecords = incomeRecords ? Object.entries(incomeRecords.yearsSums ?? {}).sort((a, b) => b[0] - a[0]) : 'No Data Available';

        const banks = clubData.cashLocations.filter(location => location.category === 'Bank Accounts');
        const admins = clubData.cashLocations.filter(location => location.category === 'Cash With Admins');
        const bank_total = banks.reduce((total, location) => total + location.location_amount, 0);
        const banksArray = banks.map(account => [account.location_name, Math.round(account.location_amount)]);
        
        const admins_total = admins.reduce((total, location) => total + location.location_amount, 0);
        const adminsArray = admins.map(admin => [admin.location_name, Math.round(admin.location_amount)]);

        const long_term_items = [];

        for (let loan of debts) {
            const existingItem = long_term_items.find(item => item[0] === loan.borrower_name);
          
            if (existingItem) {
              existingItem[1] += loan.principal_left + loan.discount;
            } else {
                long_term_items.push([loan.borrower_name, Math.round(loan.principal_left + loan.discount)]);
            }
          }
        const long_term_total = debts.reduce((total, item) => total + item.principal_left + item.discount, 0);

        const short_term_items = [];

        for (let loan of credit) {
          const existingItem = short_term_items.find(item => item[0] === loan.borrower_name);
        
          if (existingItem) {
            existingItem[1] += loan.loan_amount;
          } else {
            short_term_items.push([loan.borrower_name, Math.round(loan.loan_amount)]);
          }
        }
        

        const units_location = clubData.cashLocations.find(location => location.location_name === 'Unit Trusts');//category cash holdinngs
        const units_total = units_location ? units_location.amount : 0;
        const unitTrustDeposits = await CashHistory.find({ recipient_location_name: 'Unit Trusts' }).exec();
        const unitTrustWithdrawals = await CashHistory.find({ other_location_name: 'Unit Trusts' }).exec();

        var loanRequestsRecords = [];
        var ongoingCreditRecords = [];
        var monthlyCreditRecords = [];
        var clubDepositsRecords = [];
        var ongoingDebtRecords = [];
        var pastDebtRecords = [];
        var clubExpensesRecords = [];
        var pastCreditRecords = []; 
        var pointsRecords = [];
        var pastClubInvestments = [];
        var ongoingClubInvestments = [];
        var clubIncome = [];
        const market = [];
        var marketTotal = 0;
        
        //points market
        if(pointsMarket.length > 0) {
            for (const item of pointsMarket) {
                const member = memberData.find(person => person.fullName ==  item.seller_name);
                const result =  await getValueOfPoints(item.points_for_sale, member);
                marketTotal += result;
                market.push([item.seller_name, Math.round(result), item.points_for_sale]);
            }
        }
        
        //points sale records
        if (pointsSold) {
            sortedPointsSold.forEach(([year, record]) => {
                let values = processArray(pointsSoldArray.recordsByYear[year], (records) =>
                    records.map(record => {
                        const loan = debtHistory.find(loan => loan._id ==  record.recorded_by);
                        return [Math.round(record.points_worth), record.name, loan.borrower_name]
                    })
                );
        
                pointsRecords.push({
                    year: year,
                    values: values
                });
            });
        }
        

        // Process and structure member deposits records
        if (depositsArray !== 'No Data Available') {
            sortedDepositYears.forEach(([year, record]) => {
                let recordsByMonth = processArray(depositsArray.recordsByYear[year], (records) => {
                    const recordsByMonthMap = new Map();
        
                    records.forEach(depositRecord => {
                        const month = new Date(depositRecord.deposit_date).toLocaleString('en-US', { month: 'long' });
                        const formattedRecord = {
                            depositer: depositRecord.depositor_name,
                            date: formatDate(depositRecord.deposit_date),
                            amount: Math.round(depositRecord.deposit_amount),
                            recordedBy: depositRecord.recorded_by
                        };
        
                        if (recordsByMonthMap.has(month)) {
                            recordsByMonthMap.get(month).valuesByMonth.push(formattedRecord);
                        } else {
                            recordsByMonthMap.set(month, { month, valuesByMonth: [formattedRecord] });
                        }
                    });
        
                    return Array.from(recordsByMonthMap.values());
                });
        
                clubDepositsRecords.push({
                    year: year,
                    total: Math.round(record.deposit_amount),
                    values: recordsByMonth
                });
            });
        }
        
        
        // Process and structure loan request records
        if (loanRequests) {
            loanRequests.forEach(record => {
                    let requestObject = {
                        loanId: record._id,
                        borrower: record.borrower_name,
                        loanAmount: Math.round(record.loan_amount),
                        earliestDate: formatDate(record.earliest_date),
                        latestDate: formatDate(record.latest_date),
                        loanDuration: record.loan_duration + ' months',
                        interestRate: record.loan_rate,
                        totalInterest: Math.round(record.interest_amount),
                        discount: Math.round(record.discount),
                        spentPoints: record.points_spent,
                        currentWorth: Math.round(record.worth_at_loan), 
                        initiatedBy: record.initiated_by
                    };

                    loanRequestsRecords.push(requestObject);
                });
        }

        // Process and structure ongoing loan records
        if (debts) {
            debts.forEach(record => {
                    let paymentHistory = record.payments.map(paymentRecord => [
                        formatDate(paymentRecord.payment_date),
                        Math.round(paymentRecord.payment_amount)
                    ]);
                    
                    let loanObject = {
                        loanId: record._id,
                        borrower: record.borrower_name,
                        loanAmount: Math.round(record.loan_amount),
                        earliestDate: formatDate(record.earliest_date),
                        latestDate: formatDate(record.latest_date),
                        loanDuration: record.loan_duration + ' months',
                        interestRate: record.loan_rate,
                        totalInterest: Math.round(record.interest_amount),
                        discount: Math.round(record.discount),
                        spentPoints: record.points_spent,
                        currentWorth: Math.round(record.worth_at_loan), 
                        initiatedBy: record.initiated_by,
                        approvedBy: record.approved_by,
                        paymentDate: formatDate(new Date(record.loan_date.getTime() + (record.loan_duration * 30 * 24 * 60 * 60 * 1000))),
                        issueDate: formatDate(record.loan_date),
                        amountLeft: Math.round(record.principal_left + record.interest_amount),
                        paymentHistory: paymentHistory
                    };

                    ongoingDebtRecords.push(loanObject);
                });
        }

        // Process and structure past loans records
        if (debtRecords) {
            sortedDebts.forEach(([year, record]) => {
                let values = processArray(debtRecords.recordsByYear[year], (records) =>
                    records.map(record => {
                        let paymentHistory = record.payments.map(paymentRecord => [
                            formatDate(paymentRecord.payment_date),
                            Math.round(paymentRecord.payment_amount),
                            paymentRecord.updated_by
                        ]);
                        return {
                            loanId: record._id,
                            borrower: record.borrower_name,
                            loanAmount: Math.round(record.loan_amount),
                            earliestDate: formatDate(record.earliest_date),
                            latestDate: formatDate(record.latest_date),
                            loanDuration: record.loan_duration + ' months',
                            interestRate: record.loan_rate,
                            totalInterest: Math.round(record.interest_amount),
                            discount: Math.round(record.discount),
                            spentPoints: record.points_spent,
                            currentWorth: Math.round(record.worth_at_loan), 
                            initiatedBy: record.initiated_by,
                            approvedBy: record.approved_by,
                            issueDate: formatDate(record.loan_date),
                            paymentHistory: paymentHistory
                        };
                    })
                );
        
                pastDebtRecords.push({
                    year: year,
                    total: Math.round(record.loan_amount),
                    values: values
                });
            });
        }

        
        // Process and structure ongoing credit records
        const loans = [];
        for (const loan of credit) {
            const result = await getProfitAndDuration(loan);
            loans.push(result);
        }        
        if (loans) {
            loans.forEach((loan) => {
                let value = {
                    loanId: loan._id,
                    borrower: loan.borrower_name,
                    amount:Math.round(loan.loan_amount),
                    issueDate:formatDate(loan.loan_date),
                    elapsedTime:getDaysDifference(loan.loan_date),
                    returnAmount: Math.round(loan.profit + loan.loan_amount)
                        };
        
                ongoingCreditRecords.push(value);
            });
        } 

        // Process and structure monthly credit records
        if (pastCredit) {
            sortedCredit.forEach(([year, records]) => {
                let values = [];
                for (const month in creditArray.monthlySums[year]) {
                  const record = creditArray.monthlySums[year][month];
                  const arrayEntry = [month, Math.round(record.loan_amount), Math.round(record.profit)];
                  values.push(arrayEntry);
                }

                monthlyCreditRecords.push({
                    year: year,
                    total: Math.round(records.profit),
                    values: values
                });                
              });    
        }
        
        
        // Process and structure past credit records
        if (pastCredit) {
            sortedCredit.forEach(([year, record]) => {
                let values = processArray(creditArray.recordsByYear[year], (records) =>
                    records.map(record => {
                        return [formatDate(record.loan_date), record.borrower_name, Math.round(record.loan_amount)];
                    })
                );
        
                pastCreditRecords.push({
                    year: year,
                    total: Math.round(record.loan_amount),
                    values: values
                });
            });
        }

        //Process and structure urgent notifications
        // Calculate the date 7 days from now
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(Today.getDate() + 7);

        // Filter urgent requests with latest_date within the next 7 days
        const urgentRequests = loanRequests.filter(request => {
            const dueDate = new Date(request.latest_date);
            return dueDate <= sevenDaysFromNow;
        });
        const urgentRequestsMessages = compileMessage('Loan Request by', urgentRequests, 'latestDate', 'borrower', 'LoanRequests');

        const urgentTransfers = transferObligations.filter(transfer => {
            const dueDate = new Date(transfer.return_date);
            return dueDate <= sevenDaysFromNow;
        });
        const urgentTransfersMessages = compileMessage('Transfer to', urgentTransfers, 'return_date', 'depositor_name', 'NonClubMoney');
        
        const urgentLoanPayments = ongoingDebtRecords.filter(record => {
            const dueDate = new Date(record.paymentDate);
            return dueDate <= sevenDaysFromNow;
        });
        const urgentLoanPaymentsMessages = compileMessage('Payment on Loan by', urgentLoanPayments, 'paymentDate', 'borrower', 'LongTermLoans');
        
        function compileMessage(startPhrase, array, date, label, category){
            let messageArray = [];
            for (entry of array) {
            const dueDays = getDaysDifference(Today, entry[date]);
            const msg = {
                category: category,
                message: startPhrase + ' '+ entry[label] + ' due in '+ dueDays + ' Days'
                };
             
            messageArray.push(msg);
            }
            return messageArray
        }

        // Process and structure club expenses records
        if (expensesArray !== 'No Data Available') {
            sortedExpenseYears.forEach(([year, record]) => {
                let values = processArray(expensesArray.recordsByYear[year], (records) =>
                    records.map(expenseRecord => [formatDate(expenseRecord.date_of_recording),
                        Math.round(expenseRecord.expense_amount),
                        expenseRecord.expense_name]));

                        clubExpensesRecords.push({
                    year: year,
                    total: Math.round(record.expense_amount),
                    avgMonthlyExpense: year !== thisYear ? Math.round(record.expense_amount / 12) : Math.round(record.expense_amount / (new Date().getMonth() + 1)),
                    values: values
                });
            });
        }
        
        // Process and structure club income
        if (incomeRecords) {
            sortedIncomeRecords.forEach(([year, recording]) => {
                let earnings = processArray(incomeRecords.recordsByYear[year], (records) =>
                    records.map(record => {
                        let earningsHistory = record.earnings.map(earningsRecord => [
                            formatDate(earningsRecord.date_of_earning),
                            Math.round(earningsRecord.earnings_amount),
                            earningsRecord.source
                        ]);
                        return {
                            year: year,
                            total: Math.round(recording.earnings_amount),
                            values: earningsHistory
                        };
                    })
                );
        
                clubIncome.push({earnings});
            });
        }
        
                // Process and structure past club investments
            if (pastInvestmentsArray) {
                sortedpastInvestments.forEach(([year, recording]) => {
                    let values = processArray(pastInvestmentsArray.recordsByYear[year], (records) =>
                        records.map(record => {
                            let paymentHistory = record.payments.map(paymentRecord => [
                                formatDate(paymentRecord.date),
                                Math.round(paymentRecord.amount),
                                paymentRecord.recorded_by
                            ]);
                            return {
                                name: record.investment_name,
                                amount: Math.round(record.investment_amount),
                                investmentDate: record.investment_date,
                                about: record.details,
                                paymentHistory: paymentHistory
                            };
                        })
                    );
            
                    pastClubInvestments.push({values});
                });
            }

        // Process and structure ongoing club investments
            if (ongoingInvestmentsArray) {
                sortedongoingInvestments.forEach(([year, record]) => {
                    let values = processArray(ongoingInvestmentsArray.recordsByYear[year], (records) =>
                        records.map(record => {
                            let paymentHistory = record.payments.map(paymentRecord => [
                                formatDate(paymentRecord.date),
                                Math.round(paymentRecord.amount),
                                paymentRecord.recorded_by
                            ]);
                            return {
                                name: record.investment_name,
                                amount: Math.round(record.investment_amount),
                                investmentDate: record.investment_date,
                                about: record.details,
                                paymentHistory: paymentHistory
                            };
                        })
                    );
            
                    ongoingClubInvestments.push({values});
                });
            }


        // Construct the JSON response
        return res.json({
            adminDashboard: {
                    summary:{
                        clubMoneyLocations: {
                          totalMoney: Math.round(totalMoney),
                        },
                        deposits: {
                          currentMonth: thisMonth,
                          thisMonthSavings: Math.round(thisMonthSavings)
                        },
                        withdrawals: {
                          totalProfitsWithdrawals: 300000,//Why would we want to know this?
                          nonClubMoneyInUse: Math.round(totalNonClubMoney),
                        },
                        longTermLoans: {
                          availableForBorrowing: Math.round(totalMoney - totalDebt),
                          currentlyBorrowed: Math.round(totalDebt),
                          totalLoansEverIssued: Math.round(totalDebts)
                        },
                        shortTermLoans: {
                          currentCapital: Math.round(shortTermLoansCapital),
                          totalLoansEverIssued: Math.round(totalCredit),
                          totalProfits: totalCreditProfit//This doesnt make sence, unless you add average return %
                        },
                        points: {
                          totalPointsWorthSold: Math.round(pointsWorthSold),
                          totalPointsWorthOnMarket: Math.round(marketTotal)
                        },
                        clubFund:{
                          totalExpenses:  expensesArray.yearsSums?.[thisYear] ? Math.round(expensesArray.yearsSums[thisYear].expense_amount) : 0,
                          currentInvestments: Math.round(currentInvestmentsTotal),
                          avGrowthRate: 15.6 + '%', 
                          clubFundWorth: Math.round(clubData.clubFundWorth),
                          debt: Math.round(totalClubDebts),
                        }
                      },
                    clubMoneyLocations: {
                        banks: banksArray,
                        cashWithAdmins: adminsArray,
                        longTermLoans : long_term_items,
                        shortTermLoans : short_term_items,
                        unitTrustDeposits : unitTrustDeposits,//get format for these 
                        unitTrustWithdrawals: unitTrustWithdrawals
                      },
                      deposits: clubDepositsRecords,
                      longTermLoans: {
                        requests: loanRequestsRecords,
                        ongoingLoans: ongoingDebtRecords.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate)),
                        pastLoans: pastDebtRecords
                      },
                      shortTermLoans: {
                        ongoingLoans: ongoingCreditRecords,
                        monthlyHistory: monthlyCreditRecords,
                        loansHistory: pastCreditRecords
                      },
                      noticeBoard: urgentLoanPaymentsMessages + urgentTransfersMessages + urgentRequestsMessages,
                      points: {
                        market: market,
                        transfers:pointsRecords
                      },
                      clubFund: {
                        expenses: clubExpensesRecords,
                        investments: {
                          ongoing: ongoingClubInvestments,
                          past:pastClubInvestments
                          },
                          income:clubIncome,
                          loans:{
                            ongoing: ongoingDebtRecords.filter(loan => loan.borrower === 'Club Fund'),
                            past: pastDebtRecords.filter(loan => loan.borrower === 'Club Fund')
                          }
                        }
                } 
        });
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: 'An error occurred' });
    }
});






//Ongoing Loans  How to handle the loss? Another section showing overdue loans? Just subtract the amount left from annual profits? Subtract the amount left at the end of the year?


//Create_new_account
app.post('/create_account', async (req, res) => {
    try {
        if (!req.body.name || !req.body.email || !req.body.givenName || !req.body.password) {
            return res.json({ msg: 'Some Details are missing'});
        }

        Member.create({"member_name": req.body.name,  "email": req.body.email, "investment_amount": 0, "date_of_membership": Today, 'investment_date': Today, 'points': 500, "cummulative_units": 0, "phoneContact": '', "photo": '', "password": req.body.password, "givenName": req.body.givenName}).then();
        
        res.json({ msg: `New Account Successfuly Created` });

    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});

//Add_new_expense
app.post('/add_expense', async (req, res) => {
    try {
        if (!req.body.expense_name || !req.body.expense_amount || !req.body.expense_date) {
            return res.json({ msg: 'Some Details are missing'});
        }
        
        const newExpense = {
            expense_name: req.body.expense_name,
            expense_amount: req.body.expense_amount,
            recorded_by: 'Blaise',
            date_of_recording: req.body.expense_date,
            status: 'Undeclared'
        };

        await ClubData.updateOne(
            {}, 
            { $push: { "clubExpenses": newExpense } }).then(response => {
                res.json({ msg: `Expense Successfuly Added` });
        });     

    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});

//Add_new_investment
app.post('/add_investment', async (req, res) => {
    try {
        if (!req.body.investment_name || !req.body.investment_amount || !req.body.investment_date  || !req.body.investment_details) {
            return res.json({ msg: 'Some Details are missing'});
        }
        
        const newInvestement = {
            investment_name: req.body.investment_name,
            investment_amount: req.body.investment_amount,
            added_by: 'Blaise',
            investment_date: req.body.investment_date,
            details: req.body.investment_details,
            capitalLeft: req.body.investment_amount,
            status: 'Ongoing', 
        };

        await ClubData.updateOne(
            {}, 
            { $push: { "clubInvestments": newInvestement } }).then(response => {
                res.json({ msg: `Investement Successfuly Added` });
        });     

    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});

//Declare_investment_payments
app.post('/investment_payment', async (req, res) => {
    try {
        if (!req.body.investment_id || !req.body.payment_amount || !req.body.payment_date) {
            return res.json({ msg: 'Some details are missing' });
        }

        const clubData = await ClubData.findOne();

        const thisInvestment = clubData.clubInvestments.find(investment => investment._id == req.body.investment_id);

        const totalPayments = thisInvestment.paymentsHistory.reduce((total, payment) => total + payment.amount, 0) + req.body.payment_amount;
        let amount = req.body.payment_amount;
  
        if (totalPayments > thisInvestment.investment_amount) {
            let clubEarnings = req.body.payment_amount;
            amount = 0;
            if (thisInvestment.capitalLeft == 0) {
                clubEarnings = req.body.payment_amount - thisInvestment.capitalLeft;
            }

            await Earnings.create({
                beneficiary_name: 'Club Fund',
                date_of_earning: Today,
                destination: 'Withdrawn',
                earnings_amount: clubEarnings,
                source: thisInvestment.investment_name,
                status: 'Sent'
            });
        }

        const newPayment = {
            date: req.body.payment_date,
            amount: req.body.payment_amount,
            recorded_by: 'Blaise'
        };

        const response = await ClubData.updateOne(
            {},
            {
                $inc: { "clubInvestments.$[elem].capitalLeft": -amount },
                $push: { "clubInvestments.$[elem].paymentsHistory": newPayment }
            },
            { arrayFilters: [{ "elem._id": req.body.investment_id }] }
        );
    
        if (response.nModified > 0) {
            return res.json({ msg: `Payment successfully recorded` });
        } else {
            return res.json({ msg: `No matching document found` });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: 'An error occurred' });
    }
});


//Approve_loan_requests
app.post('/approve-loan-request', async (req, res) => {
    try {
        if (!req.body.sources) {
            return res.status(400).json({ msg: 'The sources are not selected'});
        }
        req.body.sources.forEach(item => {
            item.amount = parseInt(item.amount);
        });

        const sources_total = req.body.sources.reduce((total, item) => total + item.amount, 0);
        const loansdata = await Loans.findOne({ _id: req.body.loan_id });

        if ( sources_total != loansdata.loan_amount) {//
            return res.status(400).json({ msg: 'The sources selected do not match the loan Amount'});
        }

        const cashLocations = await CashLocations.find();

        for (const source of req.body.sources) {
            const foundLocation = cashLocations.find(location => location.name == source.location);
        //console.log(foundLocation);
            if (foundLocation && foundLocation.amount >= source.amount) {
                await CashLocations.updateOne(
                    {name: foundLocation.name },
                    { $inc: { "amount": -source.amount } }
                );
            } else {
                return res.status(400).json({ msg: `There is not enough money in '${foundLocation.name}'` });
            }
        }
        
        await Loans.updateOne(
            { _id: req.body.loan_id },
            {
                $set: {
                    "loan_status": "Ongoing",
                    "loan_date": Today,
                    "approved_by": req.user.fullName
                }
            }
        );

        await Users.updateOne(
            {fullName: loansdata .borrower_name },
            { $inc: { "points": -loansdata.points_spent} }
            );

        res.json({ msg: 'Loan Approved Successfuly' });

    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: 'An error occurred during loan approval' });//
    }
});



//Add_to_points_market
app.post('/points_sale', async (req, res) => {
    try {
        if (!req.body.points_number) {
            return res.json({ msg: 'Points Not Entered'});
        }

        const member = await Users.findOne({_id: req.body.seller_name_id});

        if (member.points >= req.body.points_number){
            if (req.body.status == 1){
        PointsMkt.create({"added_by": member.fullName,  "date_added": Today, "seller_name": member.fullName, "points_for_sale": req.body.points_number}).then();
         //Added by  
        res.json({ msg: 'Points Added Successfuly'});
            } else {
                const points_worth = await getValueOfPoints(req.body.points_number, member);
                res.json({ msg: 'Points are worth' + points_worth});
            }
        } else {
            res.json({ msg: 'Points Not Enough'}); 
        }
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});

//Add_money_Location
app.post('/new-location', async (req, res) => {
    try {
        if (!req.body.location_name) {
            return res.json({ msg: 'Location not Entered'});
        }
        let category = req.body.category == "Admins" ? "Cash With Admins" : "Bank Accounts";
        const newLocation = {
            location_name: req.body.location_name,
            location_amount: 0,
            category: category,
        };

        await ClubData.updateOne(
            {}, 
            { $push: { "cashLocations": newLocation } }).then(response => {
            res.json({ msg: 'New Location Added' });
        });

    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});


//Transfer_money_between_Locations
app.post('/transfer-club-money', async (req, res) => {
    try {
        if (!req.body.transfer_amount) {
            return res.json({ msg: 'Amount not Entered'});
        }
       
        const clubdata = await ClubData.findOne();
        const foundLocation = clubdata.cashLocations.find(location => location._id == req.body.recipient_location_id);
        const foundLocation2 = clubdata.cashLocations.find(location => location._id == req.body.sending_location_id);
        
        if(foundLocation2.location_amount >= req.body.transfer_amount){
            await updateLocations(-req.body.transfer_amount, foundLocation.location_name, foundLocation2.location_name, req.user);
        } else {
            return res.json({msg: `There is not enough money in '${foundLocation2.location_name}`});
        }
        
        await ClubData.updateOne(
            {},
            { $inc: { "cashLocations.$[elem].location_amount": req.body.transfer_amount } },
            { arrayFilters: [{ "elem.location_name": foundLocation.location_name }] }
        ); 

        res.json({ msg: 'Transfer Complete' });

    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});


//Buy_Discount 
app.post('/buy-discount', async (req, res) => {
    try {
        if (!req.body.discount_amount) {
            return res.json({ msg: 'Discount Not Entered'});
        }
        const loan = await Loans.findOne({_id: req.body.loan_id});
        const requests = await Loans.find({loan_status: "Initiation"});
        const discounts = await PointsMkt.find().exec();
        var market_total = 0;
        for (const item of discounts) {
            const member = await Users.findOne({fullName: item.seller_name});
            const result = await getValueOfPoints(item.points_for_sale, member);
            market_total += result;
        }
        const requirement = req.body.discount_amount * 0.5 * 3;
        const new_payment = loan.loan_amount + loan.interest_amount - req.body.discount_amount - requirement;
        const old_payment = loan.loan_amount + loan.interest_amount;
        const points_worth_bought = req.body.discount_amount * 4;
        const sum_result = getTotalSumsAndSort(requests, loan.latest_date, 'points_worth_bought');
        market_total -= sum_result.totalSumAll.points_worth_bought;

        if (req.body.discount_amount <= market_total){
            if (req.body.status == 1){
                Loans.updateOne({_id: req.body.loan_id}, {$inc: { discount: req.body.discount_amount, points_worth_bought: points_worth_bought }}).then();    
   
        res.json({ msg: 'Purchase Successful'});
            } else {
                res.json({msg: `Pay ${requirement} at loan approval. You'll pay back ${new_payment} instead of ${old_payment}.`});
            }
        } else {
            res.json({ msg: 'Not Enough Points to Purchase'}); 
        }
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});


//Remove_loan_requests 
app.post('/remove-loan-request', async (req, res) => {
    try {
        Loans.updateOne({_id: req.body.loan_id}, {$set: {"loan_status": "Cancelled"}}).then(); 
        res.json({ msg: 'Request removed'});
    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: `An error occurred ${error}`});
    }
});

//Remove_points_sale //check if any loans have already used the request and wait till they are approved
app.post('/end_points_sale', async (req, res) => {
    try {
        const result = await PointsMkt.deleteOne({_id: req.body.sale_id});
        res.json({ msg: 'Request removed'});
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});

//Get_discount_codes
//register one time earning if member gets another member



//End_Ongoing_Short_loan
app.post('/end_credit_loan', async (req, res) => {
    try {     
    
     const loan_data  =   await Credit.findOne({ _id: req.body.loan_id });

      const profitAndDuration = await getProfitAndDuration(loan_data, req.body.end_date);
        
        await Credit.updateOne(
            { _id: req.body.loan_id },
            {
                $set: {
                    loan_status: 'Ended',
                    end_date: req.body.end_date,
                    ended_by: 'Blaise',
                    profit: profitAndDuration.profit,
                    duration: profitAndDuration.duration
                }
            }
        ); 

        res.json({ msg: 'Loan Ended' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'An error occurred' }); // Set status for error response
    }
});


//End_Ongoing_loan
app.post('/end-ongoing-loan', async (req, res) => {
    try {
        //How to handle the loss? Another section showing overdue loans? Just subtract the amount left from annual profits? Subtract the amount left at the end of the year? Re-calculate interest based on overdue?
        Loans.updateOne({_id: req.body.loan_id}, {$set: {"loan_status": "Ended"}}).then(); 
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
        
    }
});

/*/Distribute_profits
app.post('/distribute_profits', async (req, res) => {
    try {
        // Input Validation
        if (!req.body.earnings_amount || !isIdealDate()) {
            return res.json({ msg: 'Amount Not Entered Or The Date is not yet Ideal' });
        }

        // Data Retrieval
        const members = await Users.find();
        const thisYear = new Date().getFullYear();
        const profitsData = await ClubData.findOne({});
        const memberProfit = [];
        const shortLoans = await Credit.aggregate([
            {
                $match: {
                    $expr: {
                        $eq: [{ $year: "$loan_date" }, thisYear]
                    }
                }
            }
        ]);

        const shortLoansProfit = shortLoans.reduce((total, loans) => total + loans.loan_amount, 0);


        // Calculate Member Profits
        for (const member of members) {
            const investmentDays = getDaysDifference(member.investmentDate);
            const totalUnits = member.cummulative_units + investmentDays * member.investmentAmount;
            await InvestmentUnits.create({ 'name': member.fullName, 'year': thisYear, 'units': totalUnits });

            const info = { 'name': member.fullName, 'amount': 0 };
            memberProfit.push(info);
        }

        // Pending Profits Distribution
        for (const pending of profitsData.pending_profits) {
            const yearUnits = await InvestmentUnits.find({ year: pending.year });
            const unitsTotal = yearUnits.reduce((total, units) => total + units.units, 0);

            for (const entry of yearUnits) {
                const forDistribution = pending.year === thisYear ? pending.pending_profits_amount + req.body.earnings_amount + shortLoansProfit: pending.pending_profits_amount;
                const profit = entry.units * forDistribution / unitsTotal;

                const member = memberProfit.find((m) => m.name === entry.name);
                if (member) {
                    member.amount += profit;
                }
            }
        }
        // Update member's investment details
        await Users.updateOne(
            { _id: member._id },
            {
                $set: { investmentDate: depositDate },
                $inc: { cummulativeUnits: newUnits, investmentAmount: depositAmount }
            }
        );
        
        const days = getDaysDifference(member.investmentDate, depositDate);
        const newUnits =  member.investmentAmount * days;
        //ubtract loan unit with limit being worth of member at loan time from cummulative unit for fully completed loan if they were paid that year.
        //interet correponding to the worth at loan time then given to member

        // Send Response
        res.json({ profitDistribution: memberProfit });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'An error occurred' });
    }

// Helper function to check if the date is ideal
function isIdealDate() {
    const currentDate = new Date();
    const isLastDayOfMonth = currentDate.getDate() === getLastDayOfMonth(currentDate).getDate();
    return isLastDayOfMonth && currentDate.getMonth() === 11; // December
}

// Helper function to get the last day of the month
function getLastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
});
*/

//Delete_Request 
app.post('/delete-loan-request', async (req, res) => {
    try {
        if (req.body.loan_id) {
            // Delete loan request using the loan_id
            await Loans.deleteOne({ _id: req.body.loan_id });  
            res.json({ msg: "Request Deleted" });
        } else {
            // Respond with an error if loan_id is not provided
            res.status(400).json({ msg: "loan_id is required" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: `An error occurred: ${error.message}` });
    }
});


//Make_Loan_Payments Consider if part of the interest is paid, the interest accrued that yaer has to be paid within that year 
app.post('/make-loan-payment', async (req, res) => {

    try {
        if (!req.body.payment_amount || !req.body.payment_date) {
            return res.json({ msg: 'Required information is missing. Please provide all information needed.' });
        }

        const loan_finding = await Loans.findOne({ _id: req.body.loan_id });
        const constants = await Constants.findOne();
        const member = await Users.findOne({fullName: loan_finding.borrower_name});

        if (!loan_finding) {
            return res.json({ msg: 'Loan not found' });
        }

        if (new Date(loan_finding.loan_date).getTime() > new Date(req.body.payment_date).getTime()) {//what about before another payment date?
            return res.status(400).json({ msg: "Payment date not correct!" });
        }

        let principal_left = loan_finding.principal_left - req.body.payment_amount;
        let points_balance = 0;
        let points_spent = loan_finding.points_spent;
        let loan_duration = loan_finding.loan_duration;
        const last_payment_period = getDaysDifference(loan_finding.last_payment_date, req.body.payment_date);
        let loan_units = loan_finding.loan_units + loan_finding.principal_left * last_payment_period;
        let remainder = getDaysDifference(loan_finding.loan_date, req.body.payment_date) % 30;
        let current_loan_duration = remainder / 30 < 0.24 ? Math.trunc(remainder / 30): Math.ceil(remainder / 30);    
        let point_days = Math.max(0, Math.min(12, current_loan_duration) - 6) + Math.max(18, current_loan_duration) - 18;
        let running_rate = constants.monthly_lending_rate * (current_loan_duration - point_days);
        let pending_amount_interest = running_rate * loan_finding.principal_left / 100;
        let points = constants.monthly_lending_rate * point_days * loan_finding.principal_left / 100000;
        let payment_interest_amount = 0;  
 
        if (loan_finding.payments) {
            loan_finding.payments.forEach(payment => {
                let duration = (getDaysDifference(loan_finding.loan_date, payment.payment_date) % 30) / 30 < 0.24 ? Math.trunc(getDaysDifference(loan_finding.loan_date, payment.payment_date) / 30): Math.ceil(getDaysDifference(loan_finding.loan_date, payment.payment_date) / 30);
                let point_day = Math.max(0, Math.min(12, duration) - 6) + Math.max(18, duration) - 18;         
                let payment_interest = constants.monthly_lending_rate * (duration - point_day) * payment.payment_amount / 100;
                points += constants.monthly_lending_rate * point_day * payment.payment_amount / 100000;
                payment_interest_amount += payment_interest;
            })
        }

        let msg = '';
        let loan_status = loan_finding.loan_status;
        //console.log(remainder, running_rate, pending_amount_interest);

        let totalInterestDue = pending_amount_interest + payment_interest_amount;
        let interest_amount = loan_finding.interest_amount;

        if (req.body.payment_amount < (loan_finding.principal_left + totalInterestDue)){
            if (req.body.payment_amount >= loan_finding.principal_left){
                principal_left = 0;
                interest_amount = totalInterestDue + loan_finding.principal_left - req.body.payment_amount;
            }
        } else if (req.body.payment_amount > (loan_finding.principal_left + totalInterestDue)){
            principal_left = 0;
            interest_amount = totalInterestDue;
            loan_status = "Ended";
            points_spent = points;
            points_balance = loan_finding.points_spent - points;
            const new_deposit = req.body.payment_amount - loan_finding.principal_left - interest_amount;
            loan_duration = current_loan_duration;
            let msg1 = "";
            if (new_deposit >= 5000){
            await addDeposit(member, new_deposit, req.body.payment_date, "Excess Loan Payment", req.body.payment_location, req.user);
            msg1 = `A Deposit of ${new_deposit} was recorded. It was excess Payment.`;
            }
            msg = msg1 + `The Loan is now Ended.`;
        } else if (req.body.payment_amount == (loan_finding.principal_left + totalInterestDue)){
            principal_left = 0;
            interest_amount = totalInterestDue;
            loan_status = "Ended";
            loan_duration = current_loan_duration;
            points_spent = points;
            points_balance = loan_finding.points_spent - points;
            msg = `The Loan is now Ended.`;
        }

        await CashLocations.updateOne(
            {name: req.body.payment_amount },
            { $inc: { "amount": req.body.payment_amount } }
            );
        
        const updatedLoan = {
            principal_left,
            interest_amount,
            loan_units,
            last_payment_date: req.body.payment_date,
            loan_status,
            loan_duration,
            points_spent
        };

        // Add new payment object to the payments array
        loan_finding.payments.push({
            payment_date: req.body.payment_date,
            payment_amount: req.body.payment_amount,
            updated_by: req.user.fullName
        });

        // Assign the modified payments array to updatedLoan.payments
        updatedLoan.payments = loan_finding.payments;


        await Loans.updateOne({ _id: req.body.loan_id }, { $set: updatedLoan }).then(response => {
            msg += ' Payment was successfully Recorded';
            res.json({ msg, loan_status: loan_status });
        });

        await Users.updateOne(
            {fullName: loan_finding.borrower_name },
            { $inc: { "points": points_balance} }
            );

        /*if (new Date(req.body.payment_date).getTime() > new Date(loan_finding.loan_date.getTime() + (loan_finding.loan_duration * 30 * 24 * 60 * 60 * 1000))) {//(new Date(record.loan_date.getTime() + (record.loan_duration * 30 * 24 * 60 * 60 * 1000)))
            let excess_months = getDaysDifference(loan_finding.last_payment_date, req.body.payment_date) % 30 < 0.24 ? Math.trunc(getDaysDifference(loan_finding.last_payment_date, req.body.payment_date) / 30) : Math.ceil(getDaysDifference(loan_finding.last_payment_date, req.body.payment_date) / 30);
            let duration = Math.ceil(getDaysDifference(loan_finding.loan_date, loan_finding.last_payment_date) / 30);
            let excess_interest = 0;
            if (new Date(loan_finding.last_payment_date).getTime() < new Date(loan_finding.loan_date.getTime() + (loan_finding.loan_duration * 30 * 24 * 60 * 60 * 1000)) && loan_finding.payments.length != 0) {
                let excess_interest_months = loan_finding.loan_duration - duration;
                interest_amount = loan_finding.interest_amount + excess_interest_months * constants.other_monthly_rate * loan_finding.principal_left / 100;
                if (duration >= 3) {
                    excess_interest = excess_interest_months * constants.other_monthly_rate * loan_finding.principal_left / 100;
                } else if (duration == 2 && loan_finding.loan_duration >= 3) {
                    excess_interest = constants.second_monthly_rate * loan_finding.principal_left / 100 + Math.max(0, (excess_interest_months - 1)) * constants.other_monthly_rate * loan_finding.principal_left / 100;
                } else if (duration == 1 && loan_finding.loan_duration >= 3) {
                    excess_interest = constants.second_monthly_rate * 2 * loan_finding.principal_left / 100 + Math.max(0, (excess_interest_months - 2)) * (constants.other_monthly_rate) * loan_finding.principal_left / 100;
                } else if (duration == 1 && loan_finding.loan_duration == 2) {
                    excess_interest = constants.second_monthly_rate * loan_finding.principal_left / 100;
                } else if (duration == 0) {
                    excess_interest = loan_finding.interest_amount;
                }
            } 
            
            if (duration >= 3) {
                interest_amount = loan_finding.interest_amount + excess_months * constants.other_monthly_rate * loan_finding.principal_left / 100;
            } else if (duration == 2) {
                interest_amount = loan_finding.interest_amount + Math.max(0, (duration + excess_months - 3)) * (constants.other_monthly_rate) * loan_finding.principal_left / 100 + constants.second_monthly_rate * loan_finding.principal_left / 100;
            } else if (duration == 1) {
                interest_amount = loan_finding.interest_amount + Math.max(0, (duration + excess_months - 3)) * (constants.other_monthly_rate) * loan_finding.principal_left / 100 + constants.second_monthly_rate * 2 * loan_finding.principal_left / 100;
            } 
            
        } else {

        }  
        

        let principal_left = loan_finding.principal_left - req.body.payment_amount;
        let loan_duration = loan_finding.loan_duration;
        const last_payment_period = getDaysDifference(loan_finding.last_payment_date, req.body.payment_date);
        let loan_units = loan_finding.loan_units + loan_finding.principal_left * last_payment_period;
        const loan_period = loan_units % (loan_finding.loan_amount * 30) < 0.24 ? Math.trunc(loan_units / (loan_finding.loan_amount * 30)) : Math.ceil(loan_units / (loan_finding.loan_amount * 30));//allowance of 7 day conidered.
        //loan_days = (!loan_days || loan_days < 30) ? 30 : Math.ceil(loan_days / 30) * 30;
        const high_rate = Math.max(20, (constants.min_monthly_rate + (((constants.max_lending_rate/12) - constants.min_monthly_rate)/11) * (loan_period - 1)) * 12);
        const low_rate = Math.max(12, (constants.min_monthly_rate + (((constants.min_lending_rate/12) - constants.min_monthly_rate)/11) * (loan_period - 1)) * 12);
        const low_rate_amount = low_rate * loan_period * (loan_finding.loan_amount) / 1200;
        const high_rate_amount = (loan_finding.loan_rate == low_rate || loan_finding.loan_amount <= loan_finding.worth_at_loan) ? low_rate_amount : high_rate * loan_period * (loan_finding.loan_amount - loan_finding.worth_at_loan) / 1200 + low_rate * loan_period * (loan_finding.worth_at_loan) / 1200;        
        const one_point_value = ((constants.max_lending_rate - constants.min_lending_rate) * 2 * 25 * loan_finding.worth_at_loan) / (100 * 12 * 500);
        //let interest_amount = (principal_left + loan_finding.interest_amount) <= 0 ? high_rate_amount - (loan_finding.points_spent * one_point_value) : loan_finding.interest_amount;// considering scenarios where the loan period exceeds agreed duration
        let actualRate = interest_amount * 100 * 12 /(loan_finding.loan_amount * loan_period);
        let transfer_amount = req.body.payment_amount;
        
        console.log(last_payment_period, loan_period, low_rate, low_rate_amount);
        //let transfer_amount = (principal_left + interest_amount) <= 0 ? loan_finding.principal_left : req.body.payment_amount;

        
        //const clubdata = await ClubData.findOne();
        //const foundLocation = clubdata.cashLocations.find(location => location.location_name == req.body.payment_location);

        await updateLocations(req.body.payment_amount, req.body.payment_location, "Long-Term Loans", req.user, req.body.payment_date);


        if ((principal_left + interest_amount) <= 0) {//if the last payment exceeds the principal and the interest
            const new_deposit = req.body.payment_amount - loan_finding.principal_left - interest_amount;
            principal_left = 0;
            loan_status = "Ended";
            loan_duration = getDaysDifference(loan_finding.loan_date)/30;
            interest_amount = high_rate_amount - (loan_finding.points_spent * one_point_value);
            let msg1 = "";
            if (new_deposit >= 5000){
            await addDeposit(member, new_deposit, req.body.payment_date, "Savings", req.body.payment_location, req.user);
            msg1 = `A Deposit of ${new_deposit} was recorded. It was excess Payment.`;
            }
            msg = msg1 + `The Loan is now Ended.`;

            /*await ClubData.updateOne(
                {},
                { $inc: { "cashLocations.$[elem].location_amount": (interest_amount - 0.75 * 0.5 * loan_finding.points_worth_bought) } },
                { arrayFilters: [{ "elem.location_name": req.body.payment_location }] }
            );

           // await calculateLoanDays(loan_finding.loan_date, req.body.payment_date, interest_amount);

            if (loan_finding.discount > 0) {
                
        var discount_earnings = await Earnings({recorded_by: loan_finding._id});
        
        for (const item of discount_earnings) {
            const member = await Users.findOne({ fullName: item.seller_name });

            await addDeposit(member, item.earnings_amount, req.body.payment_date, 'Points', req.body.payment_location, req.user);

            Earnings.create({
                "beneficiary_name": item.seller_name,
                "date_of_earning": req.body.payment_date,
                "destination": "Re-Invested",
                "earnings_amount": item.earnings_amount,
                "source": "Points",
                "status": "Sent"
            });

        }
            }
        } else if ((principal_left + interest_amount) <= interest_amount){//if the last payment exceeds the principal but doesnt finish the interest
            interest_amount = principal_left + interest_amount;
            principal_left = 0;
        } 

        const updatedLoan = {
            principal_left,
            interest_amount,
            loan_units,
            last_payment_date: req.body.payment_date,
            loan_status,
            loan_duration
        };

        // Add new payment object to the payments array
        loan_finding.payments.push({
            payment_date: req.body.payment_date,
            payment_amount: req.body.payment_amount,
            updated_by: req.user.fullName
        });

        // Assign the modified payments array to updatedLoan.payments
        updatedLoan.payments = loan_finding.payments;


        await Loans.updateOne({ _id: req.body.loan_id }, { $set: updatedLoan }).then(response => {
            msg += ' Payment was successfully Recorded';
            res.json({ msg });
        });

        const points_payment = 0.75 * loansdata.points_worth_bought;
        const rate_after_discount = parseFloat(((loansdata.interest_amount - loansdata.discount) * 100 * 12 / (loansdata.loan_amount * loansdata.loan_duration)).toFixed(2));

        await updateMemberPoints(loansdata.borrower_name, -loansdata.points_spent);

        const market = await PointsMkt.findOne({ seller_name: loansdata.borrower_name });
        await updateMarketPoints(loansdata, market);

        await Loans.updateOne(
            { _id: req.body.loan_id },
            {
                $set: {
                    "loan_status": "Ongoing",
                    "rate_after_discount": rate_after_discount,
                    "loan_date": Today,
                    "approved_by": req.user.fullName
                },
                $inc: { principal_left: -(loansdata.discount + 0.5 * points_payment) }
            }
        );

        await PointsSale.create({
            "name": loansdata.borrower_name,
            "transaction_date": Today,
            "points_worth": 0,
            "recorded_by": "Blaise",
            "points_involved": loansdata.points_spent,
            "reason": "Loan",
            "type": "Sell"
        });

        await ClubData.updateOne(
            { },
            { $inc: { "cashLocations.$[elem].location_amount": loansdata.loan_amount } },
            { arrayFilters: [{ "elem.location_name": "Long-Term Loans" }] }
        );

        if (loansdata.discount > 0) {
            await handlePointsSale(loansdata, market);
        }

        res.json({ msg: 'Loan Approved Successfuly' });

        async function updateMemberPoints(memberName, points) {
            await Users.updateOne({ fullName: memberName }, { $inc: { points } });
        }

        async function updateMarketPoints(loansdata, market) {
            if (market && market.points_for_sale >= loansdata.points_spent) {
                await PointsMkt.updateOne({ seller_name: loansdata.borrower_name }, { $inc: { points_for_sale: -loansdata.points_spent } });
            } else if (market && market.points_for_sale < loansdata.points_spent) {
                await PointsMkt.deleteOne({ seller_name: loansdata.borrower_name });
            }
        }

        
async function handlePointsSale(loansdata) {//handle at loan payment
    try {
        PointsSale.create({
            "name": loansdata.borrower_name,
            "transaction_date": Today,
            "points_worth": points_payment,
            "recorded_by": "Blaise",
            "points_involved": 0,
            "reason": "Loan",
            "type": "Buy"
        });

        var full_market = await updateMarket();
        const market_total = full_market.reduce((total, item) => total + item.points_worth, 0);

        for (const item of full_market) {
            const member = await Users.findOne({ fullName: item.seller_name });
            const sale_amount = (item.points_worth / market_total) * points_payment;
            const points_sold = (sale_amount / item.points_worth) * item.points_for_sale;
            const deposit = 0.5 * sale_amount;

            PointsSale.create({
                "name": item.seller_name,
                "transaction_date": Today,
                "points_worth": sale_amount,
                "recorded_by": loansdata._id,
                "points_involved": points_sold,
                "reason": "Sell",
                "type": "Sell"
            });

            await addDeposit(member, deposit, Today, 'Points', req.body.sources[0].location, req.user);

            Earnings.create({
                "beneficiary_name": item.seller_name,
                "date_of_earning": Today,
                "destination": "Re-Invested",
                "earnings_amount": deposit,
                "source": "Points",
                "status": "Sent"
            });

            await PointsMkt.updateOne({ seller_name: item.seller_name }, { $inc: { points_for_sale: -points_sold } });
            await Users.updateOne({ fullName: item.seller_name }, { $inc: { points: -points_sold } });
        }
    } catch (error) {
        console.error('Error handling points sale:', error);
        throw error; // Propagate the error to the higher level
    }
}
*/
    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: `An error occurred: ${error}` });
    }
});

//Loan_Rate_and_request_initiation

app.post('/initiate-request', async (req, res) => {
    try {
        if (!req.body.loan_amount || !req.body.loan_duration || !req.body.earliest_date || !req.body.latest_date) {
            return res.status(400).json({ msg: 'There is an entry missing. Please fill in everything needed', no: 0 });
        }

        const memberPromise = Users.findOne({_id: req.body.borrower_name_id});//getLoanAmount getLoanLimit
        const constantsPromise = Constants.findOne();
        let [
            member,
            constants
          ] = await Promise.all([memberPromise, constantsPromise]);
          
        const loan_limit = await getLoanAmount(member);

        if (req.body.loan_amount > loan_limit) {
            return res.status(400).json({ msg: `The Loan Limit of ${Math.round(loan_limit).toLocaleString('en-US')}, has been exceeded!`, no: 0 });
       }
        //let duration = req.body.loan_duration > 12 ? 12 : req.body.loan_duration;
        let duration = req.body.loan_duration;
        const total_rate = constants.monthly_lending_rate * duration;// * (req.body.loan_amount) / 100;
        let points_needed = (duration / 12) < 1.5 ? Math.max(0, (total_rate - 12)) * req.body.loan_amount / 100000 :  12 * req.body.loan_amount / 100000 + (duration - 18) * constants.monthly_lending_rate * req.body.loan_amount / 100000;
        //const actual_interest_rate = points_needed <= member.points ? Math.min(12, (constants.monthly_lending_rate * req.body.loan_duration)) : (constants.monthly_lending_rate * duration * req.body.loan_amount - member.points * 1000) / req.body.loan_amount;//constants.one_point_value
        const points_spent = points_needed <= member.points ? points_needed : member.points;
        const actual_interest =  total_rate * req.body.loan_amount / 100 - points_spent * 1000;
        let installment_amount = Math.round(req.body.loan_amount / (1000 * req.body.loan_duration)) * 1000;
        //console.log(installment_amount, points_spent, total_rate, req.body.loan_amount, points_needed);
        //const msg = `Request Successful. Total Rate for the duration of ${req.body.loan_duration} Months is ${actual_interest * 100 / req.body.loan_amount}%, requiring interest payment of ${actual_interest.toLocaleString('en-US')} and spending of ${Math.round(points_spent)} Points worth ${Math.round(points_spent * 1000)}/=. You can pay in monthly installments of ${installment_amount.toLocaleString('en-US')} or in larger amounts to pay even less interest.`;
            
            await Loans.create({"loan_duration": req.body.loan_duration, "loan_units": 0, "interest_accrued": 0, "points_accrued": 0, "loan_rate": total_rate, "earliest_date": req.body.earliest_date, "latest_date": req.body.latest_date, "loan_status": "Pending Approval", "installment_amount": installment_amount,"initiated_by": req.user.fullName, "approved_by": "", "worth_at_loan": member.investmentAmount, "loan_amount": req.body.loan_amount, "loan_date": "", "borrower_name": member.fullName, "points_spent": points_spent, "discount": 0, "points_worth_bought": 0, "rate_after_discount": total_rate, 'interest_amount': actual_interest, "principal_left": req.body.loan_amount, "last_payment_date": Today}).then();
            res.json({ msg: 'msg' });

        /*const high_rate = Math.max(20, (constants.min_monthly_rate + (((constants.max_lending_rate/12) - constants.min_monthly_rate)/11) * (req.body.loan_duration - 1)) * 12);
        const low_rate = Math.max(12, (constants.min_monthly_rate + (((constants.min_lending_rate/12) - constants.min_monthly_rate)/11) * (req.body.loan_duration - 1)) * 12);
        const low_rate_amount = low_rate * req.body.loan_duration * (req.body.loan_amount) / 1200;
        const high_rate_amount = req.body.loan_amount <= member.investmentAmount? low_rate_amount : high_rate * req.body.loan_duration * (req.body.loan_amount - member.investmentAmount) / 1200 + low_rate * req.body.loan_duration * (member.investmentAmount) / 1200;        
        const point_worth = await getValueOfPoints(1, member);
        let potentialPointsConsumed = (high_rate_amount - low_rate_amount)/point_worth;
        const actualPointsConsumed = potentialPointsConsumed <= member.points ? potentialPointsConsumed : member.points;
        const interest_amount = high_rate_amount - (actualPointsConsumed * point_worth);
        let possibleRate = interest_amount * 100 * 12 /(req.body.loan_amount * req.body.loan_duration);

        if (req.body.request_status == 0) {//this status happens anytime the amount or member changes, but only after the duration has been entered
            const msg1 = `Best Annual Rate is ${Math.round(possibleRate * 100)/100}%, ${Math.round(possibleRate * 100/12)/100}% monthly, requiring interest payment of ${Math.round(interest_amount).toLocaleString('en-US')}, and spending of ${Math.round(actualPointsConsumed)} points.`;
            return res.json({ msg, no: 1 });
            if (req.body.interest_rate === '') {
                const msg1 = `Best Annual Rate is ${Math.round(possibleRate * 100)/100}%, ${Math.round(possibleRate * 100/12)/100}% monthly, requiring interest payment of ${Math.round(interest_amount).toLocaleString('en-US')}, and spending of ${Math.round(actualPointsConsumed)} points.`;
                const savings = Math.round(high_rate_amount - interest_amount).toLocaleString('en-US');
                
                const points_worth = await getValueOfPoints(actualPointsConsumed, member);
                
                var msg2 = ` If the highest rate of ${Math.round(high_rate * 100)/100}% is paid, the required interest will be ${Math.round(high_rate_amount).toLocaleString('en-US')}, and Zero points spent. An extra ${savings} if the member can handle it and Save the Points worth ${ Math.round(points_worth).toLocaleString('en-US')}.`;
                if (Math.round(possibleRate) === Math.round(high_rate) || low_rate_amount === high_rate_amount) {
                    msg2 = '';
                }
                if (Math.round(possibleRate) === Math.round(low_rate) && req.body.loan_amount <= member.investmentAmount) {
                    msg2 = '';
                }
                const msg = msg1 + msg2;
                return res.json({ msg, no: 1 });
            } else {
                const rateInterest =  req.body.interest_rate * req.body.loan_duration * (req.body.loan_amount - member.investmentAmount) / 1200 + low_rate * req.body.loan_duration * (member.investmentAmount) / 1200;
                //const pointsConsumed = req.body.loan_amount <= member.investmentAmount ? 0 : Math.round((high_rate_amount - rateInterest)/point_worth);
                const pointsConsumed = Math.round((high_rate_amount - rateInterest)/point_worth);
                
                if (pointsConsumed <= member.points && pointsConsumed >= 0 && req.body.interest_rate >= possibleRate) {
                    const msg = `${pointsConsumed} Points are Consumed. Proceed`;
                    return res.json({ msg, no: 2 });
                } else if (pointsConsumed <= member.points && pointsConsumed <= 0 && req.body.interest_rate >= possibleRate) {
                    const msg = '0 Points are Consumed. Proceed';
                    return res.json({ msg, no: 0 });
                } else if (req.body.interest_rate < possibleRate) {
                    return res.status(400).json({ msg: `You sneaky Person, you've been caught redhanded! Enter an acceptable rate, above ${Math.round(possibleRate * 100)/100}%.`});
                } else {
                    const possibleAmount = ((low_rate * member.investmentAmount/100) + (member.points * point_worth)) * 100/req.body.interest_rate;
                    const possiblePeriod = ((low_rate * member.investmentAmount/100) + (member.points * point_worth)) * 100 * 12/(req.body.interest_rate * req.body.loan_amount);
                    const msg1 = `Only ${Math.round(member.points)} Points available, yet ${Math.round(pointsConsumed)} Points are needed. You can Reduce the amount to ${Math.trunc(possibleAmount).toLocaleString('en-US')}/=`;
                    var msg2 = ` , or change period to a maximum value of ${Math.trunc(possiblePeriod)} months.`
                    if(req.body.loan_duration < 11){
                        msg2 = '';
                    }
                    const msg =  msg1 + msg2;
                    return res.json({msg, no: 3 });
                }
            }
        } else if (req.body.request_status == 1) {//this status happens when the admin clicks on "submit request" button which only become active when every thing above has been entered
            
            if (!req.body.earliest_date || !req.body.latest_date || !req.body.interest_rate) {
                return res.status(400).json({ msg: 'There is an entry missing. Please fill in everything needed', no: 0 });
            } 

            if (req.body.interest_rate < possibleRate) {
                return res.status(400).json({ msg: `You sneaky Person, you've been caught redhanded! Enter an acceptable rate, above ${Math.round(possibleRate * 100)/100}%.`});
            }
            //check if earlier restrictions of minimum and maximum rate and period have been adhered to
                const rateInterest =  req.body.interest_rate * req.body.loan_duration * (req.body.loan_amount - member.investmentAmount) / 1200 + low_rate * req.body.loan_duration * (member.investmentAmount) / 1200;
                const pointsConsumed = Math.round((high_rate_amount - rateInterest)/point_worth);
                if (pointsConsumed <= member.points && pointsConsumed < 0) {
                    pointsConsumed = 0;
                };
                if (req.body.interest_rate >= Math.trunc(high_rate)) {
                    pointsConsumed = 0;
                };
                const interest_amount = req.body.interest_rate * req.body.loan_duration * req.body.loan_amount / 1200;
                await Loans.create({"loan_duration": req.body.loan_duration, "loan_units": 0, "loan_rate": req.body.interest_rate, "earliest_date": req.body.earliest_date, "latest_date": req.body.latest_date, "loan_status": "Initiation", "initiated_by": member.fullName, "approved_by": "", "worth_at_loan": member.investmentAmount, "loan_amount": req.body.loan_amount, "loan_date": "", "borrower_name": member.fullName, "points_spent": pointsConsumed, "discount": 0, "points_worth_bought": 0, "rate_after_discount": req.body.interest_rate, 'interest_amount': interest_amount, "principal_left": req.body.loan_amount, "last_payment_date": Today}).then();
                res.status(400).json({ msg: 'Request Successful' });
        }  */   
    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: `An error occurred ${error}`, no: 0 });
    }
});


//Short_term_Loans_initalisation
app.post('/credit', async (req, res) => {
    try {
        if (!req.body.credit_amount || !req.body.credit_date) {
            return res.json({ msg: 'There is an entry missing. Please fill in everything needed'});
        }

        const member = await Users.findOne({_id: req.body.borrower_name_id});

        await Credit.create({"loan_status": "Ongoing", "issued_by": "Blaise", "ended_by": "", "profit": 0, "loan_amount": req.body.credit_amount, "loan_date": req.body.credit_date, "borrower_name": member.fullName, "end_date": "", "duration": 0}).then(); 
//issued by    
    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: `An error occurred ${error}`});
    }
});


//Deposit_initalisation
app.post('/deposit', async (req, res) => {
    try {
        if (!req.body.deposit_amount || !req.body.deposit_date) {
            return res.json({ msg: 'There is an entry missing. Please fill in everything needed'});
        }

        const member = await Users.findOne({_id : req.body.depositor_name_id});
        const msg = await addDeposit(member, req.body.deposit_amount, req.body.deposit_date, 'Savings', req.body.deposit_location, req.user);

res.json({ msg: msg });   
    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: `An error occurred ${error}`});
    }
    
});

//Add_non_club_money
app.post('/non-club', async (req, res) => {
    try {
        if (!req.body.deposit_amount || !req.body.deposit_date || !req.body.return_date) {
            return res.json({ msg: 'There is an entry missing. Please fill in everything needed'});
        }
        const member = await Users.findOne({_id: req.body.depositor_name_id});
        // Record deposit
        await NonClub.create({
            depositor_name: member.fullName,
            deposit_date: req.body.deposit_date,
            deposit_amount: req.body.deposit_amount,
            recorded_by: "String",
            return_date: req.body.return_date,
            status: "Not-Sent",
            sent_by: "",
        });
        
res.json({ msg: msg });   
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
    
});

//#endregion



//---------------------------------------------------------------FUNCTIONS------------------------------------------------
//GET_DIFFERENCE_BETWEEN_DATES
function getDaysDifference(earlierDate, laterDate = new Date()) {
    const firstPeriod = new Date(earlierDate);
    const secondPeriod = new Date(laterDate);
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const timeDifference = secondPeriod.getTime() - firstPeriod.getTime();
    const daysApart = Math.floor(timeDifference / millisecondsPerDay);
    
    return daysApart;
}

//DEPOSIT_FUNCTION
async function addDeposit(member, depositAmount, depositDate, source, depositLocation, user) {
    try {

        // Record deposit
        await Deposit.create({
            "recorded_by": user.fullName,
            "deposit_amount": depositAmount,
            "deposit_date": depositDate,
            "depositor_name": member.fullName,
            "balance_before": member.investmentAmount,
            "source": source
        });

        // Update member's investment details
        await Users.updateOne(
            { _id: member._id },
            {
                $inc: { investmentAmount: depositAmount, points: new_points }
            }
        );

        //Update Cash Locations
        await ClubData.updateOne(
            { },
            { $inc: { "cashLocations.$[elem].location_amount": depositAmount } },
            { arrayFilters: [{ "elem.location_name": depositLocation }] }
        );

        return 'Deposit added successfully';
    } catch (error) {
        console.error(error);
        return 'An error occurred while adding the deposit';
    }
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
}

//ADD_DEPOSITS_TO_CUMMULATIVE_UNITS
async function getTotalAmountAndUnits(member) {
    try {

        const startDate = new Date(member.investmentDate);
        const query = { depositor_name: member.fullName, deposit_date: { $gte: startDate } };
        const options = { sort: { deposit_date: 1 } };
        const depositRecords = await Deposit.find(query, options);
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


//GET_DURATION_AND_PROFIT_OF_SHORT_LOANS
async function getProfitAndDuration(object, end_date = new Date()) {
    const constants = await Constants.findOne(); // Await for constants retrieval

    let loan_days = getDaysDifference(object.loan_date, end_date);
    object.duration = loan_days;

    loan_days = (!loan_days || loan_days < 30) ? 30 : Math.ceil(loan_days / 30) * 30;

    const profit = (constants.monthly_credit_rate / 100) * (loan_days / 30) * object.loan_amount;

    object.profit = profit;

    return object;
}



//GET_VALUE_OF_POINTS
async function getValueOfPoints(points, user) {
    try {
        const constants = await Constants.findOne();
        const one_point_value = constants.one_point_value;
        const points_worth = points * one_point_value;
        
        return points_worth;
    } catch (error) {
        console.error(error);
        // Handle the error or return a default value
        return 0; // You might want to handle errors more gracefully
    }
}

//GET_LOAN_LIMIT
/*async function getLoanLimit(member) {
    try { 
        const constants = await Constants.findOne();     
        // Fetch all users
        const club = await Users.find({});

        // Calculate total number of members (excluding the club Fund and example)
        const membersCount = club.length - 2;

        // Calculate total club worth
        const clubWorth = club.reduce((total, user) => total + user.investmentAmount, 0);

        // Calculate available pool
        const availablePool = constants.loan_risk * (clubWorth / 100);//include CF Contribution


        // Calculate number of benefiting members
        const benefitingMembers = constants.members_served_percentage * membersCount / 100;

        // Calculate total debt for the member
        const debts = await Loans.find({ borrower_name: member.fullName, loan_status: "Ongoing" });
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);

        
        const limit = Math.min(member.investmentAmount * constants.loan_multiple - totalDebt, (((100 - constants.loan_risk)/100)  * member.investmentAmount + (availablePool / benefitingMembers) - totalDebt));//subtract risked money from investmentAmount
        console.log((availablePool / benefitingMembers), limit);
        return limit;
    } catch (error) {
        console.error("Error occurred while calculating loan limit:", error);
        // Return a default value or handle errors more gracefully
        return 0;
    }
}
*/
//GET ACCEPTABLE LOAN AMOUNT
/*async function getLoanAmount(member) {
    try { 
        const constants = await Constants.findOne();     
        // Fetch all users
        const club = await Users.find({});

        // Calculate total number of members (excluding the club Fund and example)
        const membersCount = club.length - 2;

        // Calculate total club worth
        const clubWorth = club.reduce((total, user) => total + user.investmentAmount, 0);

        // Calculate number of benefiting members
        const benefitingMembers = constants.members_served_percentage * membersCount / 100;

        // Calculate total debt for the member
        const allDebts = await Loans.find({ loan_status: "Ongoing" });
        const debts = await Loans.find({ borrower_name: member.fullName, loan_status: "Ongoing" });
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);
        const allDebt = allDebts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);

        // Calculate available pool
        const availablePool = constants.loan_risk * (clubWorth - allDebt - member.investmentAmount) / 100;//include CF Contribution //Consider amount lent to others

        // Calculate loan limit
        const limit = Math.min(member.investmentAmount * constants.loan_multiple - totalDebt, (member.investmentAmount + (availablePool/ benefitingMembers) - totalDebt));//subtract risked money from investmentAmount
        
        console.log((availablePool / benefitingMembers), limit);
        return limit;
    } catch (error) {
        console.error("Error occurred while calculating loan limit:", error);
        // Return a default value or handle errors more gracefully
        return 0;
    }
}*/
         
async function getLoanAmount(member) {
    try { 
        const constants = await Constants.findOne();     
        // Fetch all users
        const club = await Users.find({});

        // Calculate total number of members (excluding the club Fund and example)
        const membersCount = club.length - 2;

        // Calculate total club worth
        const clubWorth = club.reduce((total, user) => total + user.investmentAmount, 0);

        // Calculate used pool and benefiting member
        let usedPool = 0;
        let benefiters = 0;
        const allDebts = await Loans.find({ loan_status: "Ongoing" });
        for (const clubMember of club) {
            const memberData = await Users.findOne({ fullName: clubMember.fullName });
            const memberDebts = allDebts.filter(loan => loan.borrower_name === clubMember.fullName);
            const memberDebtsTotal = memberDebts.reduce((total, loan) => total + loan.principal_left, 0);
            const usedPortion = Math.max(0, memberDebtsTotal - memberData.investmentAmount);
            benefiters = usedPortion > 0 ? benefiters + 1 : benefiters;
            usedPool += usedPortion;
        }

        // Calculate number of benefiting members
        const benefitingMembers = constants.members_served_percentage * membersCount / 100;

        // Calculate total debt for the member
        const debts = await Loans.find({ borrower_name: member.fullName, loan_status: "Ongoing" });
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left, 0);
        const allDebt = allDebts.reduce((total, loan) => total + loan.principal_left, 0);

        //Consider amount lent to others
        //const riskOfWorth = (usedPool / clubWorth) * req.user.investmentAmount; May not be necessary if not many members will be borrowing
        // Calculate available pool
        const availablePool = constants.loan_risk * (clubWorth - member.investmentAmount) / 100;
        
        // Calculate loan limit
        let risk = (usedPool / (clubWorth + usedPool - allDebt)) * member.investmentAmount/member.investmentAmount;
        const limit = benefiters < Math.round(benefitingMembers) && risk <= constants.loan_risk/100 ? Math.min(member.investmentAmount * constants.loan_multiple - totalDebt, (member.investmentAmount + (availablePool/ benefitingMembers) - totalDebt)) : Math.max(0, member.investmentAmount - (usedPool / (clubWorth + usedPool - allDebt)) * member.investmentAmount - totalDebt);//subtract risked money from investmentAmount
        
        console.log(risk, benefiters, Math.round(benefitingMembers), usedPool, availablePool, limit, (member.investmentAmount - (usedPool / (clubWorth + usedPool - allDebt)) * member.investmentAmount));
        return limit;
    } catch (error) {
        console.error("Error occurred while calculating loan limit:", error);
        // Return a default value or handle errors more gracefully
        return 0;
    }
}
async function getLoanLimit(member) {
    try { 
        const constants = await Constants.findOne();     
        // Fetch all users
        const club = await Users.find({});

        // Calculate total number of members (excluding the club Fund and example)
        const membersCount = club.length - 2;

        // Calculate total club worth
        const clubWorth = club.reduce((total, user) => total + user.investmentAmount, 0);

        // Calculate number of benefiting members
        const benefitingMembers = constants.members_served_percentage * membersCount / 100;

        // Calculate total debt for the member
        const allDebts = await Loans.find({ loan_status: "Ongoing" });
        const debts = await Loans.find({ borrower_name: member.fullName, loan_status: "Ongoing" });
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left, 0);
        const allDebt = allDebts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);

        // Calculate available pool
        const availablePool = constants.loan_risk * (clubWorth - member.investmentAmount) / 100;
        // Calculate loan limit
        const limit = Math.min(member.investmentAmount * constants.loan_multiple - totalDebt, (member.investmentAmount + (availablePool/ benefitingMembers) - totalDebt));
        
        console.log((availablePool / benefitingMembers), limit);
        return limit;
    } catch (error) {
        console.error("Error occurred while calculating loan limit:", error);
        // Return a default value or handle errors more gracefully
        return 0;
    }
}
        

//UPDATED_POINTS_MARKET_ARRAY
async function updateMarket() {
    try {
        const full_market = await PointsMkt.find();
        const market = [];

        for (const item of full_market) {
            const member = club.find( members => members.fullName == item.seller_name );

            if (member) {
                const result = await getValueOfPoints(item.points_for_sale, member);
                const newItem = item.toObject();
                newItem.points_worth = result;
                market.push(newItem);
            } else {
                console.error(`Member not found for seller_name: ${item.seller_name}`);
            }
        }

        return market;
    } catch (error) {
        console.error('Error updating full market:', error);
        throw error; // Propagate the error to the higher level
    }
}

//UPDATE_CASH_LOCATIONS
async function updateLocations(amount, recipient_location, other_location, admin, date = Today) {
    try {
        const clubdata = await ClubData.findOne();
         
        // Find the location in cashLocations
        const foundLocation = clubdata.cashLocations.find(location => location.location_name == recipient_location);

        if ( foundLocation) {
            // Update the specified location with the given amount
            await ClubData.updateOne(
                {},
                { $inc: { "cashLocations.$[elem].location_amount": amount } },
                { arrayFilters: [{ "elem.location_name": foundLocation.location_name }] }
            );

            // Create CashHistory entry
            await CashHistory.create({
                "recipient_location_name": recipient_location,
                "transaction_date": date,
                "transaction_amount": amount,
                "recorded_by": admin.fullName,
                "other_location_name": foundLocation.location_name,
                "category": foundLocation.category,
                "balance_before": foundLocation.location_amount
            });
        } else {
            console.error(`Location '${other_location}' not found in cashLocations.`);
        }
    } catch (error) {
        console.error('Error updating locations:', error);
        throw error; // Propagate the error to the higher level
    }
}

//ADD_PENDING_PROFITS
async function calculateLoanDays(loanDate, currentDate, interest_amount) {
    const clubdata = await ClubData.findOne();
    const startDate = new Date(loanDate);
    const endDate = new Date(currentDate);

    const getDaysInYear = (year, startDate, endDate) => {
        const endOfYear = new Date(year, 11, 31);
        const endOfLoanYear = new Date(Math.min(endOfYear, endDate));
        return Math.max(0, (endOfLoanYear - startDate) / (24 * 60 * 60 * 1000) + 1);
    };

    const loanDays = Array.from({ length: endDate.getFullYear() - startDate.getFullYear() + 1 }, (_, i) => {
        const year = startDate.getFullYear() + i;
        return { [year]: getDaysInYear(year, startDate, endDate) };
    });

    const yearly_profits = distributeProfit(interest_amount, loanDays);

    yearly_profits.forEach(year => {
        const filter = { "elem.year": year.year };
        const update = { $inc: { "pending_profits.$[elem].pending_profits_amount": year.amount } };
        
        if (clubdata.pending_profits.some(p => p.year === year.year)) {
            ClubData.updateOne({}, update, { arrayFilters: [filter] });
        } else {
            const newYear = { year: year.year, pending_profits_amount: year.amount };
            ClubData.updateOne({}, { $push: { "pending_profits": newYear } });
        }
    });
}

//distribute_profits
function distributeProfit(totalProfit, loanDays) {
    const totalLoanDays = loanDays.reduce((total, year) => total + Object.values(year)[0], 0);
    const profitPerDay = totalProfit / totalLoanDays;

    return loanDays.map(year => {
        const yearNumber = Object.keys(year)[0];
        const days = Object.values(year)[0];
        const amount = Math.round(profitPerDay * days);
        return { year: parseInt(yearNumber), amount };
    });
}

//sort_entries_by_date
function groupAndSortEntries(entriesArray, sortByProperty) {
    // Step 1: Sort the array based on the specified property
    entriesArray.sort((a, b) => new Date(a[sortByProperty]) - new Date(b[sortByProperty]));
  
    // Step 2: Group the entries by the specified property
    const groupedEntries = entriesArray.reduce((acc, entry) => {
      const propertyValue = entry[sortByProperty];
  
      if (!acc[propertyValue]) {
        acc[propertyValue] = [];
      }
  
      acc[propertyValue].push({ entry: entry.entry });
  
      return acc;
    }, {});
  
    // Step 3: Convert the groupedEntries object into an array
    const newArray = Object.entries(groupedEntries).map(([value, entries]) => ({
      [value]: entries,
    }));
  
    return newArray;
  }
  
  //GET LOAN RATE
  async function loanRate(loanDuration) {
  const constants = await Constants.findOne();
  let rate = constants.monthly_lending_rate * loanDuration;

  return rate
}

  //GET ACCRUED INTERET
  async function paymentInterest(loan_finding) {
let payment_interest_amount = 0;   
const constants = await Constants.findOne();    

if (loan_finding.payments) {
    loan_finding.payments.forEach(payment => {
        let duration = (getDaysDifference(loan_finding.loan_date, payment.payment_date) % 30) / 30 < 0.24 ? Math.trunc(getDaysDifference(loan_finding.loan_date, payment.payment_date) / 30): Math.ceil(getDaysDifference(loan_finding.loan_date, payment.payment_date) / 30);
        let payment_interest = constants.monthly_lending_rate * duration * payment.payment_amount / 100;
        payment_interest_amount += payment_interest;
    })
}

return payment_interest_amount
}
