const {notifyLoanNew, notifyLoanPayment} = require("./notify.js")


const newLoanPayload = {
  amount: 600000,
  duration: 3, // length of loan in months
  installment: 200000, //monthly installment
  user_email: "example@gmail.com"
}
notifyLoanNew(newLoanPayload)


const loanPaymentPayload = {
  amount_paid: 600000, 
  date: "2024-12-01", // date of loan payment in yyyy-mm-dd
  outstanding_debt: 200000, // outstanding debt: principal left + interest
  loan_status: "Ongoing", // status of loan after payment, Ongoing | Ended,
  user_email: "example@gmail.com"
}
notifyLoanPayment(loanPaymentPayload)