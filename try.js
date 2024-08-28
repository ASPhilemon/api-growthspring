app.post('/initiate-request', async (req, res) => {
    
  Toda = moment().tz('Africa/Nairobi').format();
  Today = new Date(Toda);
  //console.log(Today);
  thisYear = new Date().getFullYear();
  thisMonth = new Date().toLocaleString('default', { month: 'long' });
  
      try {
          if (!req.body.loan_amount || !req.body.loan_duration || !req.body.earliest_date || !req.body.latest_date) {
              return res.status(400).json({ msg: 'There is an entry missing. Please fill in everything needed', no: 0 });
          }
  
          const constantsPromise = Constants.findOne();
          const clubPromise = Users.find()
          const allDebtsPromise = Loans.find({loan_status: "Ongoing"})
          let [
              constants,
              club,
              allDebts
            ] = await Promise.all([ constantsPromise, clubPromise, allDebtsPromise]);
            
          const member = club.filter((user)=>user.fullName === req.user.fullName)
          const debts = allDebts.filter((loan)=> loan.borrower_name === req.user.fullName)
          const loan_limit = getLoanAmount(member, constants, club, allDebts, debts);
  
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