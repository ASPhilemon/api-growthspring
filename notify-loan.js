const ejs = require("ejs")
const { sendMail } =  require("./util/sendMail");

async function notifyLoanNew(loanNewParams) {
  const { amount, duration, installment, user_email, user_first_name} = loanNewParams
  const emailParams = {
    senderName: "growthspring",
    recipientEmail: user_email, 
    emailSubject: "Loan Application Successful",
    emailTemplate: __dirname + "/views/loan-new.ejs",
    context : { amount, duration, installment, user_first_name }
  }

  try {
    sendMail(emailParams)
  } catch (error) {
    console.error("Error Sending Email:", error);
  }
}


async function notifyLoanPayment(loanPaymentParams) {
  const {
    loan_status,
    user_email,
  } = loanPaymentParams

  const emailParams = {
    senderName: "growthspring",
    recipientEmail: user_email, 
    emailSubject: "Loan Payment Confirmation",
    emailTemplate: loan_status == "Ongoing"?
      __dirname + "/views/loan-payment.ejs":
      __dirname + "/views/loan-cleared.ejs",
    context : loanPaymentParams
  }
  try {
    sendMail(emailParams)
  } catch (error) {
    console.error("Error Sending Email:", error);
  }
}


module.exports = { notifyLoanNew, notifyLoanPayment}
