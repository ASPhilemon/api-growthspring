const {notifyLoanNew, notifyLoanPayment} = require("./notify-loan.js")


const loanNewParams = {
  amount: 600000,
  duration: 3, //length of loan in months
  installment: 200000, //monthly installment
  user_email: "philemonariko@gmail.com",
  user_first_name: "Philemon" //first name of member
}
//notifyLoanNew(loanNewParams)


const loanPaymentParams = {
  amount_paid: 600000, 
  date: "Jan 4 2025", // date of loan payment in specified format
  outstanding_debt: 200000, // outstanding debt: principal left + interest
  loan_status: "Ongoing", // status of loan after payment, Ongoing | Ended,
  user_email: "philemonariko@gmail.com",
  user_first_name: "Philemon" //first name of member
}

notifyLoanPayment(loanPaymentParams)