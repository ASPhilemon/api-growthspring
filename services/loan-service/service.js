// model
import { Loan, Constants, PointsSale } from "./models.js";

// util
import * as DB from "../../utils/db-util.js";
import * as ErrorUtil from "../../utils/error-util.js"; // Assuming this path exists

// collaborator services
import * as UserServiceManager from "../user-service/service.js";
import * as EmailServiceManager from "../email-service/service.js";
import * as CashLocationServiceManager from "../cash-location-service/service.js";
import * as DepositServiceManager from "../deposit-service/service.js"; // New service for deposits

// --- Helper Functions (these remain internal to this service) ---

/**
 * Calculates the difference in days between two dates.
 * @param {Date | string} date1 - The first date.
 * @param {Date | string} date2 - The second date.
 * @returns {number} The number of days difference.
 */
function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}


// --- Loan Service Functions ---

export async function getLoans() {
  return await Loan.find();
}

export async function getMemberOngoingLoans(memberName) {
  return await Loan.find({"borrower_name": memberName, loan_status: "Ongoing"});
  }

export async function getMemberEndedLoans(memberName) {
  return await Loan.find({"borrower_name": memberName, loan_status: "Ended"});
}  

export async function getLoanById(loanId){
  const loan = await DB.tryMongoose(Loan.findById(loanId));
  const statusCode = 400;
  if (!loan) throw new ErrorUtil.AppError("Failed to find loan", statusCode);
  return loan;
}

export async function initiateLoanRequest(
  loanAmount,
  loanDuration,
  earliestDate,
  latestDate,
  borrowerId,
  currentUser
) {
  if (!loanAmount || !loanDuration || !earliestDate || !latestDate || !borrowerId) {
    throw new ErrorUtil.AppError('Required loan request information is missing. Please fill in everything needed.', 400);
  }

  const today = new Date();
  
  const [member, constants, allDebts] = await Promise.all([
    UserServiceManager.getUser(borrowerId), 
    DB.tryMongoose(Constants.findOne()), 
    DB.tryMongoose(Loan.find({ loan_status: "Ongoing" })),
  ]);

  if (!member) {
    throw new ErrorUtil.AppError('Borrower not found.', 404);
  }
  if (!constants) {
    throw new ErrorUtil.AppError('System constants not found.', 500);
  }

  const debts = allDebts.filter((loan) => loan.borrower_name === member.fullName);
  const loanLimit = member.investmentAmount - debts.reduce((total, loan) => total + loan.principal_left, 0);

  if (loanAmount > loanLimit) {
    throw new ErrorUtil.AppError(`The Loan Limit of ${Math.round(loanLimit).toLocaleString('en-US')} has been exceeded!`, 400);
  }

  const duration = loanDuration;
  const totalRate = constants.monthly_lending_rate * duration;
  let pointsNeeded = (duration / 12) < 1.5 ? Math.max(0, (totalRate - 12)) * loanAmount / 100000 : 12 * loanAmount / 100000 + (duration - 18) * constants.monthly_lending_rate * loanAmount / 100000;

  const pointsSpent = pointsNeeded <= member.points ? pointsNeeded : member.points;
  const actualInterest = totalRate * loanAmount / 100 - pointsSpent * 1000;
  const installmentAmount = Math.round(loanAmount / (1000 * loanDuration)) * 1000;

  const newLoan = {
    loan_duration: loanDuration,
    loan_units: 0,
    interest_accrued: 0,
    points_accrued: 0,
    loan_rate: totalRate,
    earliest_date: earliestDate,
    latest_date: latestDate,
    loan_status: "Pending Approval",
    installment_amount: installmentAmount,
    initiated_by: currentUser.fullName,
    approved_by: "",
    worth_at_loan: member.investmentAmount,
    loan_amount: loanAmount,
    loan_date: today,
    borrower_name: member.fullName, 
    points_spent: pointsSpent,
    discount: 0,
    points_worth_bought: 0,
    rate_after_discount: totalRate,
    interest_amount: actualInterest,
    principal_left: loanAmount,
    last_payment_date: today,
  };

  const createdLoan = await DB.tryMongoose(Loan.create(newLoan));
  return createdLoan;
}

export async function approveLoan(loanId, approvedBy, sources) {
  const loan = await DB.tryMongoose(Loan.findById(loanId));
  const statusCode = 400; 

  if (!loan) {
    throw new ErrorUtil.AppError("Loan not found.", 404); 
  }
  if (loan.loan_status !== "Pending Approval") {
    throw new ErrorUtil.AppError("Loan is not in 'Pending Approval' status.", statusCode);
  }

  // Validate total amount from sources
  const totalFromSources = sources.reduce((total, source) => total + source.amount, 0);
  if (totalFromSources !== loan.loan_amount) {
    throw new ErrorUtil.AppError('The total amount from selected sources does not match the loan amount.', statusCode);
  }

  // Assume 'source.location' in the `sources` array now refers to the `cashLocationId`.
  for (const source of sources) {
    const cashLocation = await CashLocationServiceManager.getCashLocation(source.location); // Use service to get location
    if (!cashLocation) {
        throw new ErrorUtil.AppError(`Cash location with ID '${source.location}' not found.`, 404);
    }
    if (cashLocation.amount < source.amount) {
      throw new ErrorUtil.AppError(`Insufficient balance in '${cashLocation.name}'. Required: ${source.amount}, Available: ${cashLocation.amount}.`, statusCode);
    }
  }

  await Promise.all(
    sources.map(source =>
      CashLocationServiceManager.deductFromCashLocation(source.location, source.amount)
    )
  );

  const updatedLoan = await DB.tryMongoose(Loan.updateOne(
    { _id: loanId },
    {
      $set: {
        loan_status: "Ongoing",
        approved_by: approvedBy.fullName,
        loan_date: new Date(),
        sources: sources, 
      },
    }
  ));

  if (updatedLoan.matchedCount === 0) {
      throw new ErrorUtil.AppError("Failed to approve loan. Loan not found or update failed.", 500);
  }

  return updatedLoan;
}

export async function cancelLoanRequest(loanId) {
  const updatedLoan = await Loan.updateOne({ _id: loanId }, { $set: { "loan_status": "Cancelled" } });
  if (updatedLoan.matchedCount === 0) {
      throw new Error("Loan request not found or already cancelled.");
  }
  return { msg: 'Loan request cancelled successfully.' };
}


export async function deleteLoanPermanently(loanId) {
  if (!loanId) {
    throw new Error("loan_id is required.");
  }
  const result = await Loan.deleteOne({ _id: loanId });
  if (result.deletedCount === 0) {
      throw new Error("Loan request not found or already deleted.");
  }
  return { msg: "Loan request deleted permanently." };
}

export async function getLoanPayments(loanId) {
    // Assuming payments are embedded or linked to a loan
    const loan = await Loan.findById(loanId);
    if (!loan) {
        throw new Error("Loan not found.");
    }
    return loan.payments || []; 
}

export async function getLoanPayment(loanId, paymentId) {
    // Assuming payments are embedded in the Loan model
    const loan = await Loan.findById(loanId);
    if (!loan) {
        throw new Error("Loan not found.");
    }
    const payment = loan.payments.id(paymentId); 
    if (!payment) {
        throw new Error("Loan payment not found.");
    }
    return payment;
}

export async function makeLoanPayment(
  loanId,
  paymentAmount,
  paymentDate,
  paymentCashLocationId,
  currentUser
) {
  if (!paymentAmount || !paymentDate || !loanId || !paymentCashLocationId) {
    throw new ErrorUtil.AppError('Required payment information is missing. Please provide all information needed.', 400);
  }

  const today = new Date();
  const parsedPaymentDate = new Date(paymentDate);

  const [loan, constants] = await Promise.all([
    DB.tryMongoose(Loan.findById(loanId)),
    DB.tryMongoose(Constants.findOne()),
  ]);

  if (!loan) {
    throw new ErrorUtil.AppError('Loan not found.', 404);
  }
  if (!constants) {
    throw new ErrorUtil.AppError('System constants not found.', 500);
  }

  
  const member = await UserServiceManager.getUserByFullName(loan.borrower_name);
  if (!member) {
    throw new ErrorUtil.AppError('Borrower user not found for this loan.', 404);
  }

  if (new Date(loan.loan_date).getTime() > parsedPaymentDate.getTime()) {
    throw new ErrorUtil.AppError("Payment date cannot be before the loan initiation date!", 400);
  }

  const loanYear = new Date(loan.loan_date).getFullYear();
  
  
  let pointsBalance = 0; 
  let pointsSpentOnLoan = loan.points_spent; 

  const lastPaymentPeriodDays = getDaysDifference(loan.last_payment_date, parsedPaymentDate);
  let loanUnits = loan.loan_units + loan.principal_left * lastPaymentPeriodDays; 

  const totalDaysSinceLoan = getDaysDifference(loan.loan_date, parsedPaymentDate);
  let currentLoanDurationMonths = totalDaysSinceLoan / 30;
  currentLoanDurationMonths = (currentLoanDurationMonths % 1 < 0.24) ? Math.trunc(currentLoanDurationMonths) : Math.ceil(currentLoanDurationMonths);

  const daysSinceLastPayment = getDaysDifference(loan.loan_date, loan.last_payment_date);
  let lastPaymentDurationMonths = daysSinceLastPayment / 30;
  lastPaymentDurationMonths = (lastPaymentDurationMonths % 1 < 0.24) ? Math.trunc(lastPaymentDurationMonths) : Math.ceil(lastPaymentDurationMonths);
  
  let currentPrincipalDurationMonths = currentLoanDurationMonths - lastPaymentDurationMonths;

  let pointDays = Math.max(0, Math.min(12, currentLoanDurationMonths) - 6) + Math.max(0, currentLoanDurationMonths - 18);
  let runningRate = constants.monthly_lending_rate * (currentLoanDurationMonths - pointDays);

  let pendingInterestAmount = loanYear === thisYear
    ? constants.monthly_lending_rate * currentPrincipalDurationMonths * loan.principal_left / 100
    : runningRate * loan.principal_left / 100;
  
  let principalLeft = loan.principal_left;
  let loanInterestAmount = loan.interest_amount;
  let loanStatus = loan.loan_status;
  let loanDurationActual = loan.loan_duration; 
  
  let pointsSpentForLoan = constants.monthly_lending_rate * pointDays * loan.principal_left / 100000;
  let paymentsInterestAmount = 0;
  
  if (loan.payments) {
    loan.payments.forEach(payment => {
        const paymentDurationDays = getDaysDifference(loan.loan_date, payment.payment_date);
        let paymentDurationMonths = paymentDurationDays / 30;
        paymentDurationMonths = (paymentDurationMonths % 1 < 0.24) ? Math.trunc(paymentDurationMonths) : Math.ceil(paymentDurationMonths);                
        let paymentInterest = constants.monthly_lending_rate * (duration - point_day) * payment.payment_amount / 100;
                
        let paymentPointDay = Math.max(0, Math.min(12, paymentDurationMonths) - 6) + Math.max(0, paymentDurationMonths - 18);
        pointsSpentForLoan += constants.monthly_lending_rate * paymentPointDay * payment.payment_amount / 100000;
        paymentsInterestAmount += paymentInterest;
    });
  }

  // Calculate total interest due before this payment
  let totalInterestDue = loanYear === thisYear
    ? pendingInterestAmount
    : pendingInterestAmount + paymentsInterestAmount; 
  
  // A safety check if totalInterestDue somehow becomes 0 when it shouldn't
  if (totalInterestDue === 0 && loan.principal_left > 0) {
      totalInterestDue = constants.monthly_lending_rate * loan.principal_left / 100;
  }

  // Logic for applying payment amount
  let paymentMsg = '';
  if (paymentAmount < (principalLeft + totalInterestDue)) {
    if (paymentAmount >= principalLeft) {
      principalLeft = 0;
      loanInterestAmount = totalInterestDue + loan.principal_left - paymentAmount;
    } else {
        principalLeft -= paymentAmount;
    }
  } else if (paymentAmount >= (principalLeft + totalInterestDue)) {
    principalLeft = 0;
    loanInterestAmount = 0; 
    loanStatus = "Ended";
    loanDurationActual = currentLoanDurationMonths;
    pointsSpentOnLoan = pointsSpentForLoan; 
    pointsBalance = loan.points_spent - pointsSpentForLoan;

    const newDepositAmount = paymentAmount - loan.principal_left - totalInterestDue;
    if (newDepositAmount >= 5000) {
      await DepositServiceManager.createDeposit({ 
        userId: member._id,
        amount: newDepositAmount,
        cashLocationId: paymentCashLocationId, 
        reason: "Excess Loan Payment",
        transaction_date: parsedPaymentDate,
        recordedBy: currentUser.fullName
      });
      paymentMsg += `A Deposit of ${newDepositAmount.toLocaleString('en-US')} was recorded as excess Payment. `;
    }
    paymentMsg += `The Loan is now Ended.`;
  }

  await CashLocationServiceManager.addToCashLocation(paymentCashLocationId, paymentAmount);

  const newPaymentRecord = {
    payment_date: parsedPaymentDate,
    payment_amount: paymentAmount,
    updated_by: currentUser.fullName,
    payment_location: paymentCashLocationId, 
  };

  const updatedLoanData = {
    principal_left: principalLeft,
    interest_amount: loanInterestAmount,
    loan_units: loanUnits,
    last_payment_date: parsedPaymentDate,
    loan_status: loanStatus,
    loan_duration: loanDurationActual,
    points_spent: pointsSpentOnLoan,
    $push: { payments: newPaymentRecord },
  };

  const loanUpdateResult = await DB.tryMongoose(Loan.updateOne({ _id: loanId }, { $set: updatedLoanData }));

  if (loanUpdateResult.matchedCount === 0) {
      throw new ErrorUtil.AppError("Failed to update loan. Loan not found or no changes applied.", 500);
  }
  
  paymentMsg += ' Payment was successfully Recorded.';

  if (pointsSpentOnLoan > 0) {
    await DB.tryMongoose(PointsSale.create({ 
      "name": member.fullName, 
      "transaction_date": parsedPaymentDate,
      "points_worth": pointsSpentOnLoan * 1000,
      "recorded_by": currentUser.fullName,
      "points_involved": pointsSpentOnLoan,
      "reason": "Loan interest",
      "type": "Spent"
    }));
  }

  if (pointsBalance !== 0) {
      await UserServiceManager.updateUser(member._id, { $inc: { "points": pointsBalance} }); 
  }

  const formattedDate = parsedPaymentDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const notificationParams = {
    amount_paid: paymentAmount,
    date: formattedDate,
    outstanding_debt: principalLeft + loanInterestAmount,
    loan_status: loanStatus,
    user_email: member.email,
    user_first_name: member.displayName || member.fullName
  };

  await EmailServiceManager.sendEmail({ 
    sender: "growthspring", 
    recipient: notificationParams.user_email,
    subject: "Loan Payment Recorded",
    message: `Dear ${notificationParams.user_first_name},\n\nYour loan payment of ${notificationParams.amount_paid.toLocaleString('en-US')} on ${notificationParams.date} has been recorded.\nOutstanding debt: ${notificationParams.outstanding_debt.toLocaleString('en-US')}\nLoan Status: ${notificationParams.loan_status}`
  });

  return { msg: paymentMsg, loan_status: loanStatus };
}

export async function deleteLoanPayment(loanId, paymentId) {// Complex Logic for the current scope
    const loan = await Loan.findById(loanId);
    if (!loan) {
        throw new Error("Loan not found.");
    }

    // Remove the payment subdocument from the array
    loan.payments.pull(paymentId);
    await loan.save(); 

    return { msg: 'Loan payment deleted successfully.' };
}