//Home_page_fetch optimized
app.get('/homepage-data-opt', async (req, res) => {

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
  const currentUnitsPromise = getTotalAmountAndUnits(req.user)
  const maxLimitPromise =  getLoanLimit(req.user);
  const allDebtsPromise =  Loans.find({ loan_status: "Ongoing" });
  const memberPromise = Users.findOne({ fullName: clubMember.fullName });

  const [
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
    member
  ] = Promise.all([
    constantsPromise, clubPromise, clubDepositsPromise, clubEarningsPromise,
    clubUnitsRecordsPromise, memberDepositsPromise, debtsPromise, debtHistoryPromise,
    discountsPromise, earningsPromise, pointsPromise, unitsPromise, unitsPromise,
    currentUnitsPromise, maxLimitPromise, allDebtsPromise, memberPromise
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
     

      // Calculate used pool
      let usedPool = 0;
   
      const allDebt = allDebts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);
      for (const clubMember of club) {
        
          const memberDebts = allDebts.filter(loan => loan.borrower_name === clubMember.fullName);
          const memberDebtsTotal = memberDebts.reduce((total, loan) => total + loan.principal_left + loan.interest_amount, 0);
          usedPool += Math.max(0, memberDebtsTotal - member.investmentAmount);
      }
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
   
});