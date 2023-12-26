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

//Loan_Rate_and_request_initiation
//Buy_Discount
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
const cors = require('cors')
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

//auth imports
const {requireAuth, requireAdmin} = require('./auth/middleware')
const authRoutes = require('./auth/routes')

//express app
const app = express();

// Use the express.json() middleware to parse JSON data
app.use(express.json());

//connect to mongoDB
// const dbURI = 'mongodb+srv://blaise1:blaise119976@cluster0.nmt34.mongodb.net/GrowthSpringNew?retryWrites=true&w=majority';
const dbURI = 'mongodb+srv://PhilemonAriko:M5kKuyHbGEitFwFW@cluster0.z9m53.mongodb.net/growthspring?retryWrites=true&w=majority'

mongoose.connect(dbURI, {useNewUrlParser: true, useUnifiedTopology: true})
    .then((result) => app.listen(4000));

//register view engine
app.set('view engine', 'ejs');

//middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(cors())

//auth routes
app.use('/auth', authRoutes)

//Auntenticated Routes (Logged in members)
app.use(requireAuth)

//#pages
//user page
app.get('/loan_initiate', (req, res) => {
    res.render('loan_initiate');
});

app.get('/loan_requests', (req, res) => {
    res.render('loan_requests');
});

app.get('/credit', (req, res) => {
    res.render('credit');
});

app.get('/points', (req, res) => {
    res.render('points');
});

app.get('/deposits', (req, res) => {
    res.render('deposits');
});

app.get('/money_locations', (req, res) => {
    res.render('money_locations');
});

//admin page
app.get('/admin', (req, res) => {
    res.render('adminR');
});

//#constants
//CONSTANTS FOR BACKEND
const Today = new Date(Date.now());
//COMFIRMATION BOXES FOR ALL SERIOUS BUTTONS

//Page_requests
//Get member's list
app.get('/members', (req, res) => {
    Member.find().then(result => {        
        res.json({list: result});
    });
});

//Get member's list
app.get('/locations-list', (req, res) => {
    ClubData.findOne().then(result => {        
        res.json({list: result.cashLocations});
    });
});


//Home_page_fetch
app.get('/homepage-data', async (req, res) => {
    let memberDashboardData = {
        summary : {
          memberDeposits : {
            yourWorth: 800000,
          },
          payments: {
            avgYearlyReturn: '20% Over 5 years'
          },
          loans: {
            currentDebt: 1500000,
          },
          points: {
            points: 200,
          },
          clubDeposits: {
            clubWorth: 12000000
          },
          clubEarnings: {
            clubWorth: 12000000
          },
        },
        home: {
          clubWorth: 15800000,
          members: 20,
          thisYearDeposits: 6000000,
          yourWorth: 1200000,
          risk: '12%',
          thisYearSavings: 400000,
          yourDebt: 450000,
          bestRate: '12%',
          maxLoanLimit: 3500000,
          points: 10,
          pointsWorth : 200000,
          pointWorth: 20000
        },
      
        memberDeposits: [
          {
            year: 2023,
            total: 2000000,
            avgMonthyDeposit: 35000,
            values:  [
              [ '3/4/2023', 30000, 'Savings'],
              [ '3/4/2023', 20000, 'Payment'],
              [ '3/4/2023', 10000, 'Points'],
            ]
          },
          {
            year: 2022,
            total: 5000000,
            avgMonthyDeposit: 95000,
            values:  [
              [ '3/4/2022', 90000, 'Savings'],
              [ '3/4/2022', 10000, 'Payment'],
              [ '3/4/2022', 30000, 'Points'],
            ]
          }, 
          {
          year: 2021,
            total: 0,
            avgMonthyDeposit: 0,
            values:  []
          },
        ],
      
        payments: [
          {
            year: 2023,
            total: 5000000,
            roi: '14%',
            values:  [
              [ '3/4/2023', 30000, 'Profit', 'Withdrawn'],
              [ '3/4/2023', 20000, 'Points', 'Reinvested'],
              [ '3/4/2023', 10000, 'Points', 'Reinvested'],
            ]
          },
          {
            year: 2022,
            total: 2000000,
            roi: '18%',
            values:  [
              [ '3/4/2023', 30000, 'Profit', 'Withdrawn'],
              [ '3/4/2023', 20000, 'Points', 'Reinvested'],
              [ '3/4/2023', 10000, 'Points', 'Reinvested'],
            ]
          },
        ],
      
        loans:  [
          {
            loanId: 1,
            issueDate: '2/2/2023',
            loanAmount: 500000,
            amountPaid: 400000,
            nextInstallmentDate: '3/3/2021',
            agreedLoanDuration: '3 months',
            annualInterestRate: '15%',
            pointsSpent: 400,
            status: 'ongoing',
            paymentHistory:  [
              ['2/2/2045',500000],
              ['2/5/2021',100000],
              ['5/4/2099',900000],
            ]
          },
          {
            loanId: 2,
            issueDate: '20/7/2022',
            loanAmount: 500000,
            amountPaid: 400000,
            nextInstallmentDate: '3/3/2021',
            agreedLoanDuration: '3 months',
            annualInterestRate: '12%',
            pointsSpent: 400,
            status: 'ongoing',
            paymentHistory:  [
              ['2/2/2045',500000],
              ['2/5/2021',100000],
              ['5/4/2099',900000],
            ]
          },
        ],
      
        points: [
          {
            year: 2023,
            total: 400000,
            values:  [
              ['2/2/2045',500, 'Sell'],
              ['2/5/2021',100, 'Loan'],
              ['5/4/2099',9000, 'Sell'],
            ]
          },
          {
            year: 2022,
            total: 200000,
            values:  [
              ['2/2/2045',500, 'Sell'],
              ['2/5/2021',100, 'Loan'],
              ['5/4/2099',9000, 'Sell'],
            ]
          },
        ],
      
        clubDeposits: [
          {
            year: 2023,
            total: 2000000,
            avgMonthyDeposit: 600000,
            values:  [
              ['January',500000],
              ['February',100000],
              ['March',900000],
            ]
          },
          {
            year: 2022,
            total: 14000000,
            values:  [
              ['January',500000],
              ['February',10000],
              ['March',900000],
              ['April',500000],
              ['May',100000],
              ['June',900000],
              ['July',500000],
              ['August',100000],
              ['September',900000],
              ['October',500000],
              ['November',100000],
              ['December',900000],
            ]
          }
        ],
      
        clubEarnings: [
          ['2024', 900000, '1%'],
          ['2023', 500000, '2%'],
          ['2022', 300000, '3%'],
        ]
      
    }
    res.json(memberDashboardData)
});

//Loan Requests Lists
app.get('/loan-requests-lists', async (req, res) => {
    try {
        const requests = await Loans.find({ loan_status: "Initiation" });
        const nonClubmoney = await NonClub.find({ status: "Pending" });

        // Calculate the date 7 days from now
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(Today.getDate() + 7);

        // Filter urgent requests with latest_date within the next 7 days
        const urgentRequests = requests.filter(request => {
            const dueDate = new Date(request.latest_date);
            return dueDate <= sevenDaysFromNow;
        });

        const urgentTransfers = nonClubmoney.filter(transfer => {
            const dueDate = new Date(transfer.return_date);
            return dueDate <= sevenDaysFromNow;
        });

        return res.json({ loan_requests: requests, urgentRequests: urgentRequests, urgentTransfers: urgentTransfers });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: 'An error occurred' });
    }
});


//Past Loans
app.get('/past-loans', (req, res) => {
    Loans.find({loan_status: "Ended"}).then(past_loans => {
        return res.json({ past_loans: past_loans});
    });
    
});

//Past Deposits
app.get('/credit-history', async (req, res) => {
    try {
        const deposits = await Deposit.find().exec();

        const result = getTotalSumsAndSort(deposits, 'deposit_date', 'deposit_amount');
        
        return res.json({ deposit_monthly_totals: result.monthlySums, deposit_totals: result.totalSumAll});
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
    }
    
    
});

//Ongoing Loans  How to handle the loss? Another section showing overdue loans? Just subtract the amount left from annual profits? Subtract the amount left at the end of the year?
app.get('/ongoing-loans', async (req, res) => {
    const ongoingLoans = await Loans.find({loan_status: "Ongoing"});
                // Filter urgent loans with due_date within the next 7 days
                const urgentPayments = ongoingLoans.filter(request => {
                    const loanDate = new Date(request.loan_date);
    const dueDate = new Date(loanDate.setMonth(loanDate.getMonth() + request.loan_duration));

                    return dueDate <= sevenDaysFromNow;
                });
        return res.json({ ongoing_loans: ongoingLoans, urgent_payments: urgentPayments}); //ADD princial_left to profit

    
});

//Points history
app.get('/point-sales-history', async (req, res) => {
    try {
        const past_sales = await PointsSale.find().exec();

        const result = getTotalSumsAndSort(past_sales, 'transaction_date', 'points_worth');
        
        return res.json({ pointsPast: result.recordsByYear});
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
    }
    
});


//Monthly short loan history
app.get('/credit-history', async (req, res) => {
    try {
        const past_credit_loans = await Credit.find({ loan_status: "Ended"}).exec();

        const result = getTotalSumsAndSort(past_credit_loans, 'loan_date', 'loan_amount', 'profit');
               
        return res.json({ past_credit_loans_monthly_totals: result.monthlySums, past_credit_loans_totals: result.totalSumAll});
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
    }
    
});

//Ongoing short loans
app.get('/ongoing-credit-loans', async (req, res) => {
    try {
        const ongoing_credit_loans = await Credit.find({ loan_status: "Ongoing" }).exec();

        const loans = [];
        for (const loan of ongoing_credit_loans) {
            const result = await getProfitAndDuration(loan);
            loans.push(result);
        }

        return res.json({ ongoing_credit_loans: loans });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
    }
});

//Club Money Locations
app.get('/club-money-locations', async (req, res) => {
    try {
        const clubdata = await ClubData.findOne();

        const banks = clubdata.cashLocations.filter(location =>
            location.category === 'Bank Accounts' || location.category === 'Cash With Admins'
        );
        const bank_total = banks.reduce((total, location) => total + location.location_amount, 0);

        const admins = clubdata.cashLocations.filter(location =>
            location.category === 'Cash With Admins'
        );
        const admins_total = admins.reduce((total, location) => total + location.location_amount, 0);

        const long_term = await Loans.find({ loan_status: 'Ongoing' }).exec();
        const long_term_items = [];
        for (let loan of long_term){
            const item = { location_amount: loan.principal_left + loan.discount, location_name: loan.borrower_name};
            long_term_items.push(item);
        }
        const long_term_total = long_term.reduce((total, item) => total + item.principal_left + item.discount, 0);

        const short_term = await Credit.find({ loan_status: 'Ongoing' }).exec();
        const short_term_items = [];
        for (let loan of short_term){
            const item = { location_amount: loan.loan_amount, location_name: loan.borrower_name};
            short_term_items.push(item);
        }
        const short_term_location = clubdata.cashLocations.find(location => location.location_name === 'Short Loans');
        const short_total = short_term_location ? short_term_location.location_amount : 0;

        const units_location = clubdata.cashLocations.find(location => location.location_name === 'Unit Trusts');
        const units_total = units_location ? units_location.amount : 0;

        const data = {
            banks: { items: banks, total: bank_total },
            admins: { items: admins, total: admins_total },
            long_term: { items: long_term_items, total: long_term_total},
            short_term: { items: short_term_items, total: short_total },
            units: { deposit: await CashHistory.find({ recipient_location_name: 'Unit Trusts' }).exec(), withdrawals: await CashHistory.find({ other_location_name: 'Unit Trusts' }).exec(), total: units_total }
        };

        return res.json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
    }
});


//Points Market
app.get('/points-mkt', async (req, res) => {
    try {
        const items = await PointsMkt.find().exec();

        const market = [];
        for (const item of items) {
            const member = await Member.findOne({member_name: item.seller_name});
            const result =  await getValueOfPoints(item.points_for_sale, member);
            const newItem = item.toObject();
            newItem.points_worth = result;
            market.push(newItem);
        }
        return res.json({ onMkt: market });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
    }
});

//Create_new_account
// app.post('/create_account', async (req, res) => {
//     try {
//         if (!req.body.name || !req.body.email || !req.body.givenName || !req.body.password) {
//             return res.json({ msg: 'Some Details are missing'});
//         }

//         Member.create({"member_name": req.body.name,  "email": req.body.email, "investment_amount": 0, "date_of_membership": Today, 'investment_date': Today, 'points': 500, "cummulative_units": 0, "phoneContact": '', "photo": '', "password": req.body.password, "givenName": req.body.givenName}).then();
        
//         res.json({ msg: `New Account Successfuly Created` });

//     } catch (error) {
//         console.error(error);
//         res.json({ msg: 'An error occurred'});
//     }
// });

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
            return res.json({ msg: 'Some Details are missing'});
        }
        
        const newPayment = {
            date: req.body.payment_date,
            amount: req.body.payment_amount,
            recorded_by: 'Blaise'
        };

        await ClubData.updateOne(
            {}, 
            { $push: { "clubInvestments.$[elem].paymentsHistory": newPayment }}, { arrayFilters: [{ "elem._id": req.body.investment_id }] }).then(response => {
                res.json({ msg: `Payment Successfuly Recorded` });
        });     

    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});

//Approve_loan_requests
app.post('/approve-loan-request', async (req, res) => {
    try {
        if (!req.body.sources) {
            return res.json({ msg: 'The sources are not selected'});
        }
        req.body.sources.forEach(item => {
            item.amount = parseInt(item.amount);
        });

        const sources_total = req.body.sources.reduce((total, item) => total + item.amount, 0);
        const loansdata = await Loans.findOne({ _id: req.body.loan_id });

        if ( sources_total != loansdata.loan_amount) {//
            return res.json({ msg: 'The sources selected do not match the loan Amount'});
        }

        const clubdata = await ClubData.findOne();

        for (const source of req.body.sources) {
            const foundLocation = clubdata.cashLocations.find(location => location._id == source.location);
        
            if (foundLocation && foundLocation.location_amount >= source.amount) {
                await updateLocations(-source.amount, "Long-Term Loans", foundLocation.location_name);
            } else {
                return res.json({ msg: `There is not enough money in '${foundLocation.location_name}'` });
            }
        }
        

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
                    "approved_by": "Blaise"
                },
                $inc: { principal_left: -(loansdata.discount + 0.5 * points_payment) }
            }
        );
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
            await Member.updateOne({ member_name: memberName }, { $inc: { points } });
        }

        async function updateMarketPoints(loansdata, market) {
            if (market && market.points_for_sale >= loansdata.points_spent) {
                await PointsMkt.updateOne({ seller_name: loansdata.borrower_name }, { $inc: { points_for_sale: -loansdata.points_spent } });
            } else if (market && market.points_for_sale < loansdata.points_spent) {
                await PointsMkt.deleteOne({ seller_name: loansdata.borrower_name });
            }
        }

        
async function handlePointsSale(loansdata) {
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
            const member = await Member.findOne({ member_name: item.seller_name });
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

            await addDeposit(member, deposit, Today, 'Points', req.body.sources[0].location);

            Earnings.create({
                "beneficiary_name": item.seller_name,
                "date_of_earning": Today,
                "destination": "Re-Invested",
                "earnings_amount": deposit,
                "source": "Points",
                "status": "Sent"
            });

            await PointsMkt.updateOne({ seller_name: item.seller_name }, { $inc: { points_for_sale: -points_sold } });
            await Member.updateOne({ member_name: item.seller_name }, { $inc: { points: -points_sold } });
        }
    } catch (error) {
        console.error('Error handling points sale:', error);
        throw error; // Propagate the error to the higher level
    }
}

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'An error occurred during loan approval' });
    }
});



//Add_to_points_market
app.post('/points_sale', async (req, res) => {
    try {
        if (!req.body.points_number) {
            return res.json({ msg: 'Points Not Entered'});
        }

        const member = await Member.findOne({_id: req.body.seller_name_id});

        if (member.points >= req.body.points_number){
            if (req.body.status == 1){
        PointsMkt.create({"added_by": member.member_name,  "date_added": Today, "seller_name": member.member_name, "points_for_sale": req.body.points_number}).then();
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
            await updateLocations(-req.body.transfer_amount, foundLocation.location_name, foundLocation2.location_name);
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
            const member = await Member.findOne({member_name: item.seller_name});
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
        res.json({ msg: 'An error occurred'});
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

//Distribute_profits
app.post('/distribute_profits', async (req, res) => {
    try {
        // Input Validation
        if (!req.body.earnings_amount || !isIdealDate()) {
            return res.json({ msg: 'Amount Not Entered Or The Date is not yet Ideal' });
        }

        // Data Retrieval
        const members = await Member.find();
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

        const shortLoansProfit = shortLoans.reduce((total, loans) => total + loans.loan_amount, 0);;

        // Calculate Member Profits
        for (const member of members) {
            const investmentDays = getDaysDifference(member.investment_date);
            const totalUnits = member.cummulative_units + investmentDays * member.investment_amount;
            await InvestmentUnits.create({ 'name': member.member_name, 'year': thisYear, 'units': totalUnits });

            const info = { 'name': member.member_name, 'amount': 0 };
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



//Make_Loan_Payments Consider if payments extend beyond the agreed date, 
app.post('/make-loan-payment', async (req, res) => {
    try {
        if (!req.body.payment_amount || !req.body.payment_date) {
            return res.json({ msg: 'Required information is missing. Please provide all information needed.' });
        }

        const loan_finding = await Loans.findOne({ _id: req.body.loan_id });

        if (!loan_finding) {
            return res.json({ msg: 'Loan not found' });
        }

        let principal_left = loan_finding.principal_left - req.body.payment_amount;
        const last_payment_period = getDaysDifference(loan_finding.last_payment_date, req.body.payment_date);
        let loan_units = loan_finding.loan_units + loan_finding.principal_left * last_payment_period;
        const loan_period = loan_finding.loan_duration * (365 / 12);
        const loan_units_ratio = loan_units / (loan_finding.loan_amount * loan_period);
        let points_spent = loan_units_ratio <= 1 ? loan_finding.points_spent - loan_finding.points_spent * loan_units_ratio : loan_finding.points_spent;
        let interest_amount = loan_units_ratio <= 1 ? loan_finding.interest_amount * loan_units_ratio : loan_finding.interest_amount;
        let transfer_amount = (principal_left + interest_amount) <= 0 ? loan_finding.principal_left : req.body.payment_amount;

        
        const clubdata = await ClubData.findOne();
        const foundLocation = clubdata.cashLocations.find(location => location._id == req.body.payment_location);

        await updateLocations(transfer_amount, foundLocation.location_name, "Long-Term Loans", req.body.payment_date);

        let msg = '';
        let loan_status = loan_finding.loan_status;

        if ((principal_left + interest_amount) <= 0) {//if the last payment exceeds the principal and the interest
            const new_deposit = req.body.payment_amount - loan_finding.principal_left - interest_amount;
            const member = await Member.findOne({ member_name: loan_finding.borrower_name });
            principal_left = 0;
            loan_status = "Ended";
            const restored_points = loan_finding.points_spent - points_spent;
            Member.updateOne({ member_name: loan_finding.borrower_name }, { $inc: { points: restored_points } }).then();
            await addDeposit(member, new_deposit, req.body.payment_date, "Savings", req.body.payment_location);
            msg = `A Deposit of ${new_deposit} was recorded. It was excess Payment. The Loan is now Ended.`;

            await ClubData.updateOne(
                {},
                { $inc: { "cashLocations.$[elem].location_amount": (interest_amount - 0.75 * 0.5 * loan_finding.points_worth_bought) } },
                { arrayFilters: [{ "elem.location_name": req.body.payment_location }] }
            );

            await calculateLoanDays(loan_finding.loan_date, req.body.payment_date, interest_amount);

            if (loan_finding.discount > 0) {
                
        var discount_earnings = await Earnings({recorded_by: loan_finding._id});
        
        for (const item of discount_earnings) {
            const member = await Member.findOne({ member_name: item.seller_name });

            await addDeposit(member, item.earnings_amount, req.body.payment_date, 'Points', req.body.payment_location);

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
            points_spent,
            loan_units,
            last_payment_date: req.body.payment_date,
            loan_status
        };

        updatedLoan.payments = {
            payment_date: req.body.payment_date,
            payment_amount: req.body.payment_amount,
            updated_by: "Blaise"
        };

        await Loans.updateOne({ _id: req.body.loan_id }, { $set: updatedLoan }).then(response => {
            msg += ' Payment was successfully Recorded';
            res.json({ msg });
        });
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred' });
    }
});

//Loan_Rate_and_request_initiation //CONSIDER EDITING AS ANOTHER STATUS TO PULL THEN CREATE
app.post('/initiate-request', async (req, res) => {
    try {
        if (!req.body.loan_amount || !req.body.loan_duration) {
            return res.json({ msg: 'There is an entry missing. Please fill in everything needed', no: 0 });
        }

        const member = await Member.findOne({_id: req.body.borrower_name_id});

        if (req.body.request_status == 0) {
            if (req.body.interest_rate === '') {
                const possiblePoints = (member.points * member.investment_amount) / ((req.body.loan_amount - member.investment_amount) * req.body.loan_duration);
                let possibleRate = Math.max(12, Math.min(20, Math.round(((20 - possiblePoints) * 0.4 + 12) * 100) / 100));
                const ratePoints = ((12 - possibleRate) / 8) * 20 + 20;
                const pointsConsumed = Math.round((req.body.loan_amount - member.investment_amount) / member.investment_amount * ratePoints * req.body.loan_duration);
    
                if (possibleRate === 20 && req.body.loan_amount > member.investment_amount) {
                    possibleRate = 20;
                    pointsConsumed = member.points;
                } else if (possibleRate < 12) {
                    possibleRate = 12;
                } else if (possibleRate > 20 && req.body.loan_amount <= member.investment_amount) {
                    possibleRate = 12;
                    pointsConsumed = 0;
                }
    
                const msg = `Best Rate is ${possibleRate}%, and ${pointsConsumed} points used`;
                return res.json({ msg, no: 1 });
            } else {
                const ratePoints = ((12 - req.body.interest_rate) / 8) * 20 + 20;
                const pointsConsumed = Math.round((req.body.loan_amount - member.investment_amount) / member.investment_amount * ratePoints * req.body.loan_duration);
    
                if (pointsConsumed <= member.points && pointsConsumed >= 0) {
                    const msg = `${pointsConsumed} Points are Consumed. Proceed`;
                    return res.json({ msg, no: 2 });
                } else if (pointsConsumed <= member.points && pointsConsumed < 0) {
                    const msg = '0 Points are Consumed. Proceed';
                    return res.json({ msg, no: 0 });
                } else {
                    const possibleAmount = Math.max(50000, (member.points + ratePoints * req.body.loan_duration) * member.investment_amount / (ratePoints * req.body.loan_duration));
                    const possiblePeriod = (member.points * member.investment_amount) / (ratePoints * (req.body.loan_amount - member.investment_amount));
                    const msg = `Only ${Math.round(member.points)} Points available, yet you need ${Math.round(pointsConsumed)} Points. Change one or more of the following; Reduce amount to ${Math.trunc(possibleAmount).toLocaleString('en-US')}/=, or change period to a maximum value of ${Math.trunc(possiblePeriod)} months.`;
                    return res.json({ msg, no: 3 });
                }
            }
        } else if (req.body.request_status == 1) {
            
            if (!req.body.earliest_date || !req.body.latest_date || !req.body.interest_rate) {
                return res.json({ msg: 'There is an entry missing. Please fill in everything needed', no: 0 });
            } else {
                const ratePoints = ((12 - req.body.interest_rate) / 8) * 20 + 20;
                var pointsConsumed = Math.round((req.body.loan_amount - member.investment_amount) / member.investment_amount * ratePoints * req.body.loan_duration);
                if (pointsConsumed <= member.points && pointsConsumed < 0) {
                    pointsConsumed = 0;
                };
                const interest_amount = req.body.interest_rate * req.body.loan_duration * req.body.loan_amount / 1200;
                Loans.create({"loan_duration": req.body.loan_duration, "loan_units": 0, "loan_rate": req.body.interest_rate, "earliest_date": req.body.earliest_date, "latest_date": req.body.latest_date, "loan_status": "Initiation", "initiated_by": member.member_name, "approved_by": "", "worth_at_loan": member.investment_amount, "loan_amount": req.body.loan_amount, "loan_date": "", "borrower_name": member.member_name, "points_spent": pointsConsumed, "discount": 0, "points_worth_bought": 0, "rate_after_discount": req.body.interest_rate, 'interest_amount': interest_amount, "principal_left": req.body.loan_amount, "last_payment_date": Today}).then();
            }// why is payments having empty new field? //initiated by...
        }     
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred', no: 0 });
    }
});

//Short_term_Loans_initalisation
app.post('/credit', async (req, res) => {
    try {
        if (!req.body.credit_amount || !req.body.credit_date) {
            return res.json({ msg: 'There is an entry missing. Please fill in everything needed'});
        }

        const member = await Member.findOne({_id: req.body.borrower_name_id});

        Credit.create({"loan_status": "Ongoing", "issued_by": "Blaise", "ended_by": "", "profit": 0, "loan_amount": req.body.credit_amount, "loan_date": req.body.credit_date, "borrower_name": member.member_name, "end_date": "", "duration": 0}).then(); 
//issued by    
    } catch (error) {
        console.error(error);
        res.json({ msg: 'An error occurred'});
    }
});


//Deposit_initalisation
app.post('/deposit', async (req, res) => {
    try {
        if (!req.body.deposit_amount || !req.body.deposit_date) {
            return res.json({ msg: 'There is an entry missing. Please fill in everything needed'});
        }

        const member = await Member.findOne({_id: req.body.depositor_name_id});
        const msg = await addDeposit(member, req.body.deposit_amount, req.body.deposit_date, 'Savings', req.body.deposit_location);

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
async function addDeposit(member, depositAmount, depositDate, source, depositLocation) {
    try {
        const days = getDaysDifference(member.investment_date, depositDate);
        const newUnits =  member.investment_amount * days;

        // Record deposit
        await Deposit.create({
            "recorded_by": "Blaise",
            "deposit_amount": depositAmount,
            "deposit_date": depositDate,
            "depositor_name": member.member_name,
            "balance_before": member.investment_amount,
            "source": source
        });

        // Update member's investment details
        await Member.updateOne(
            { _id: member._id },
            {
                $set: { investment_date: depositDate },
                $inc: { cummulative_units: newUnits, investment_amount: depositAmount }
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
async function getValueOfPoints(points, member) {
    try {
        const constants = await Constants.findOne();
        const one_point_value = ((constants.max_lending_rate - constants.min_lending_rate) * 25 * 2 * member.investment_amount) / (100 * 12 * 500);
        const points_worth = points * one_point_value;

        return points_worth;
    } catch (error) {
        console.error(error);
        // Handle the error or return a default value
        return 0; // You might want to handle errors more gracefully
    }
}

//UPDATED_POINTS_MARKET_ARRAY
async function updateMarket() {
    try {
        const full_market = await PointsMkt.find();
        const market = [];

        for (const item of full_market) {
            const member = await Member.findOne({ member_name: item.seller_name });

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
async function updateLocations(amount, recipient_location, other_location, date = Today) {
    try {
        const clubdata = await ClubData.findOne();

        // Find the location in cashLocations
        const foundLocation = clubdata.cashLocations.find(location => location.location_name == other_location);

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
                "recorded_by": "Blaise",
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
