import { MongoClient } from "mongodb";
import dotenv from "dotenv";

//load environemnt variables
dotenv.config()

const OLD_DB_URI = process.env.MONGODB_URI_OLD
const OLD_DB_NAME = "GrowthSpringNew"
const NEW_DB_URI = process.env.MONGODB_URI
const NEW_DB_NAME = process.env.NODE_ENV == "production"? "growthspring" : "test-growthspring"

const migrationResults = []

async function migrateDatabase(){
  const clientOldDB = new MongoClient(OLD_DB_URI)
  const clientNewDB = new MongoClient(NEW_DB_URI)

  console.log(`connecting to old database, [${OLD_DB_NAME}] ...`)
  console.log(`connecting to new database, [${NEW_DB_NAME}] ...`)
  
  const [oldDBConn, newDBConn] = await Promise.all([
    clientOldDB.connect(),
    clientNewDB.connect()
  ])
  const oldDB = oldDBConn.db(OLD_DB_NAME)
  const newDB = newDBConn.db(NEW_DB_NAME)

  //Drop New Database 
  const dropDB = process.argv.includes("-d");
  if(dropDB){
    console.log("dropping new database ...")
    await newDB.dropDatabase();
  }

  console.log("starting migration ...")
  const [oldUsers, oldDeposits, oldLoans, oldPointTransactions] = await Promise.all([
    oldDB.collection("users").find().toArray(),
    oldDB.collection("deposits").find().toArray(),
    oldDB.collection("loans").find().toArray(),
    oldDB.collection("pointssales").find().toArray()
  ])

  await Promise.all([
    migrateUsers(oldUsers, newDB),
    migrateDeposits(oldUsers, oldDeposits, newDB),
    migrateLoans(oldLoans, oldUsers, newDB),
    migratePointTransactions(oldPointTransactions, oldUsers, newDB)
  ])

  console.log("\nDATABASE MIGRARTION  SUCCEEDED ✔ ")
  migrationResults.forEach((result)=>console.log(result))
  await clientOldDB.close()
  await clientNewDB.close()
}

async function migrateUsers(oldUsers, newDB){

  const newUsers = oldUsers.map((user)=> transformUser(user))
  const userOps = newUsers.map((newUser)=>{
    return {
      updateOne: {
      filter: { "_id": newUser._id },
      update: { $setOnInsert: newUser },
      upsert: true
    }
  }})

  const passwords = oldUsers.map((user)=>{
    return {
      hash: user.password,
      user: {_id: user._id,fullName: user.fullName, email: user.email}
    }
  })

  const passwordOps = passwords.map((password)=>{
    return {
      updateOne: {
      filter: { "user._id": password.user._id },
      update: { $setOnInsert: password },
      upsert: true
    }
  }})

  const [userResult, passwordResult] = await Promise.all([
    newDB.collection("users").bulkWrite(userOps),
    newDB.collection("passwords").bulkWrite(passwordOps)
  ])

  migrationResults.push(`${userResult.upsertedCount} users migrated`)
}

async function migrateDeposits(oldUsers, oldDeposits, newDB){
  const newDeposits = oldDeposits.map((deposit)=>transformDeposit(deposit, oldUsers))
  const depositOps = newDeposits.map((newDeposit)=>{
    return {
      updateOne: {
      filter: { _id: newDeposit._id },
      update: { $setOnInsert: newDeposit },
      upsert: true
    }
  }})

  const yearlyDeposits = calculateYearlyDeposits(oldDeposits)
  const yearlyDepositOps = yearlyDeposits.map((yearlyDeposit)=>{
    return {
      updateOne: {
        filter: {year: yearlyDeposit.year},
        update: {$setOnInsert: yearlyDeposit},
        upsert: true
      }
    }
  })

  const [depositResult, yearlyDepositResult] = await Promise.all([
    newDB.collection("deposits").bulkWrite(depositOps),
    newDB.collection("yearly-deposits").bulkWrite(yearlyDepositOps),
  ])

  migrationResults.push(`${depositResult.upsertedCount} deposits migrated`)
}

async function migrateLoans(oldLoans, oldUsers, newDB){
  const newLoans = oldLoans.map((oldLoan)=>transformLoan(oldLoan, oldUsers))
  const loanOps = newLoans.map((newLoan)=>{
    return {
      updateOne: {
      filter: { _id: newLoan._id },
      update: { $setOnInsert: newLoan },
      upsert: true
    }
  }})

  const result = await newDB.collection("loans").bulkWrite(loanOps)
  migrationResults.push(`${result.upsertedCount} loans migrated`)
}

async function migratePointTransactions(oldTransactions, oldUsers, newDB){
  const newTransactions = oldTransactions
  .map((transaction)=>transformPointTransaction(transaction, oldUsers))
  .filter((transaction)=>transaction.points > 0)

  const transactionOps = newTransactions.map((newTransaction)=>{
    return {
      updateOne: {
      filter: { _id: newTransaction._id },
      update: { $setOnInsert: newTransaction },
      upsert: true
    }
  }})

  const result = await newDB.collection("point-transactions").bulkWrite(transactionOps)
  migrationResults.push(`${result.upsertedCount} point transactions migrated`)
}

//helper functions
function transformUser(user){
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    membershipDate: user.membershipDate,
    permanentInvestment: {
      amount: user.investmentAmount,
      units: user.cummulativeUnits,
      unitsDate: user.investmentDate
    },
    temporaryInvestment: { amount: 0, units: 0, unitsDate: new Date() },
    isActive: user.active || false,
    points: user.points,
    displayName: user.displayName,
    isAdmin: user.isAdmin || false,
    photoURL: user.photoURL,
  }
}

function transformDeposit(deposit, users){
  const depositor = users.find((user)=>user.fullName == deposit.depositor_name)
  const recordedBy = users.find((user)=>user.fullName == deposit.recorded_by)
  return {
    _id: deposit._id.toString(),
    type: "Permanent",
    depositor: {_id: depositor?._id, fullName: depositor?.fullName},
    date: deposit.deposit_date,
    amount: deposit.deposit_amount,
    source: deposit.source,
    balanceBefore: deposit.balance_before,
    pointsBefore: null,
    cashLocation: null,
    recordedBy: {_id: recordedBy?._id, fullName: recordedBy?.fullName},
  }
}

function calculateYearlyDeposits(deposits) {
  const yearlyDeposits = new Map();

  deposits.forEach(({ deposit_amount, deposit_date }) => {
    const year = deposit_date.getFullYear();
    const month = deposit_date.getMonth();
    if (!yearlyDeposits.has(year)) {
      yearlyDeposits.set(year, { year, total: 0, monthTotals: Array(12).fill(0) });
    }
    const yearlyDeposit = yearlyDeposits.get(year);
    yearlyDeposit.total += deposit_amount;
    yearlyDeposit.monthTotals[month] += deposit_amount;
  });

  return Array.from(yearlyDeposits.values());
}

function transformLoan(loan, users){
  const adminBlaise = users.find((user)=>user.fullName == "Mwebe Blaise Adrian")
  const borrower = users.find((user)=>user.fullName == loan.borrower_name )
  const initiatedBy = users.find((user)=>user.fullName == loan.initiated_by ) || adminBlaise
  const approvedBy = users.find((user)=>user.fullName == loan.approved_by) || adminBlaise
  return {
    _id: loan._id,
    duration: loan.loan_duration,
    rate: loan.loan_rate,
    earliestDate: loan.earliest_date,
    latestDate: loan.latest_date,
    type: "Standard",
    status: loan.loan_status,
    initiatedBy: {
      id: initiatedBy._id,
      name: initiatedBy.fullName
    },
    approvedBy: {
      id: approvedBy._id,
      name: approvedBy.fullName
    },
    worthAtLoan: loan.worth_at_loan,
    amount: loan.loan_amount,
    date: loan.loan_date,
    borrower: {
      id: borrower._id,
      name: borrower.fullName
    },
    pointsSpent: loan.points_spent,
    principalLeft: loan.principal_left,
    lastPaymentDate: loan.last_payment_date,
    units: loan.loan_units,
    rateAfterDiscount: loan.rate_after_discount,
    discount: loan.discount,
    pointsWorthBought: loan.points_worth_bought,
    pointsAccrued: loan.points_accrued,
    interestAccrued: loan.interest_accrued,
    interestAmount: loan.interest_amount,
    installmentAmount: loan.installment_amount,
    sources: [],
    payments: loan.payments.map((payment)=>{
      let updatedBy = users.find((user)=>user.fullName == payment.updated_by) || adminBlaise
      return {
        date: payment.payment_date,
        amount: payment.payment_amount,
        updatedBy: {id: updatedBy._id, name: updatedBy.fullName },
        location: null
      }
    }),
  }
}

function transformPointTransaction(transaction, users){
  const transformedTransaction = transaction.type == "Spent" ?
  transformRedeemPointTransaction(transaction, users) :
  transformAwardPointTransaction(transaction, users)
  return transformedTransaction
}

function transformRedeemPointTransaction(transaction, users){
  const redeemedBy = users.find((user)=>user.fullName == transaction.name)
  return {
    _id: transaction._id,
    type: "redeem",
    redeemedBy: { _id: redeemedBy._id, fullName: redeemedBy.fullName},
    points: transaction.points_involved,
    date: transaction.transaction_date,
    reason: transaction.reason,
    refId: null
  }
}

function transformAwardPointTransaction(transaction, users){
  const recipient = users.find((user)=>user.fullName == transaction.name)
  return {
    _id: transaction._id,
    type: "award",
    recipient: { _id: recipient._id, fullName: recipient.fullName},
    points: transaction.points_involved,
    date: transaction.transaction_date,
    reason: transaction.reason,
    refId: null
  }
}

//perform migration
await migrateDatabase()
