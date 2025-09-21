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
  const [oldUsers, oldDeposits, oldLoans, oldPointTransactions, oldEarnings, oldUnits] = await Promise.all([
    oldDB.collection("users").find().toArray(),
    oldDB.collection("deposits").find().toArray(),
    oldDB.collection("loans").find().toArray(),
    oldDB.collection("pointssales").find().toArray(),
    oldDB.collection("earnings").find().toArray(),
    oldDB.collection("units").find().toArray()
  ])

  await Promise.all([
    migrateUsers(oldUsers, newDB),
    migrateDeposits(oldUsers, oldDeposits, newDB),
    migrateLoans(oldLoans, oldUsers, newDB),
    migratePointTransactions(oldPointTransactions, oldUsers, newDB),
    migrateEarnings(oldEarnings, oldUsers, newDB),
    migrateUnits(oldUnits, oldUsers, newDB)
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
      unitsDate: user.membershipDate < new Date(new Date().getFullYear(), 0, 1) ? new Date("2024-12-31") : user.membershipDate
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

function safeDaysBetween(start, end) {
  // Returns whole days from start -> end (0 if end <= start or either invalid)
  if (!start || !end) return 0;
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (isNaN(d1) || isNaN(d2)) return 0;
  // Strip to UTC midnight to avoid TZ drift
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const diff = utc2 - utc1;
  if (diff <= 0) return 0;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay); // exact integer once times are zeroed
}

function transformLoan(loan, users){
  const adminBlaise = users.find((user)=>user.fullName == "Mwebe Blaise Adrian")
  const borrower = users.find((user)=>user.fullName == loan.borrower_name )
  const initiatedBy = users.find((user)=>user.fullName == loan.initiated_by ) || adminBlaise
  const approvedBy = users.find((user)=>user.fullName == loan.approved_by) || adminBlaise

  const totalPayments = loan.payments.reduce((s, e) => s + (e?.payment_amount || 0), 0);

  // Payment units only if loan ended and there are payments.
  let paymentUnits = 0;
  if (loan.status === "Ended" && payments.length > 0) {
    const lastDate = loan.last_payment_date;
    for (const p of payments) {
      const amount = p?.payment_amount || 0;
      const days = safeDaysBetween(p?.payment_date, lastDate); // 0 if invalid or future
      paymentUnits += days * amount;
    }
  }

  // Loan units across loan_date -> last_payment_date, never negative or NaN
  const loanSpanDays = safeDaysBetween(loan.loan_date, loan.last_payment_date);
  const loanUnits = (loan.loan_amount || 0) * loanSpanDays - paymentUnits;

  // Interest = (totalPaid + principalLeft - originalPrincipal), floored at 0
  const principalLeft = loan.principal_left || 0;
  const loanAmount = loan.loan_amount || 0;
  const interest = Math.max(0, totalPayments + principalLeft - loanAmount);
  
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
    units: loanUnits,
    rateAfterDiscount: loan.rate_after_discount,
    discount: loan.discount,
    pointsWorthBought: loan.points_worth_bought,
    pointsAccrued: loan.points_accrued,
    interestAccrued: loan.interest_accrued,
    interestAmount: interest,
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

// ----------------------------
// UNITS
// ----------------------------
async function ensureUnitsIndexes(newDB) {
  const col = newDB.collection("units");

  // Drop the legacy unique index if it exists (beneficiary._id + year)
  try {
    const idx = await col.indexes();
    const legacy = idx.find(i => i.name === "beneficiary._id_1_year_1");
    if (legacy) {
      await col.dropIndex("beneficiary._id_1_year_1");
      console.log("Dropped legacy index beneficiary._id_1_year_1");
    }
  } catch (e) {
    // ignore if index didn't exist
    if (e?.codeName !== "IndexNotFound") throw e;
  }

  // Ensure the correct unique index for the new schema
  await col.createIndex({ fullName: 1, year: 1 }, { unique: true, name: "fullName_1_year_1" });
  console.log("Ensured index fullName_1_year_1 on units");
}


function transformUnit(legacy) {
  // legacy: { _id, name, year: "2023", units: Long|Number|{$numberLong:"..."} }
  const fullName = legacy?.name ?? "";
  const year = Number(legacy?.year);
  // when read via the driver, this is usually a Number; fall back to Number(...)
  const rawUnits = legacy?.units;
  const units =
    typeof rawUnits === "number"
      ? rawUnits
      : typeof rawUnits?.toNumber === "function"
      ? rawUnits.toNumber()
      : Number(rawUnits?.$numberLong ?? rawUnits ?? 0);

  return {
    fullName,
    year,
    units: Math.max(0, Number.isFinite(units) ? units : 0),
    // timestamps are added by Mongoose on insert in your app;
    // leave them out in the migration document
  };
}

async function migrateUnits(oldUnits, _oldUsers, newDB) {
  await ensureUnitsIndexes(newDB);
  // Transform
  const newUnits = oldUnits
    .map(transformUnit)
    // keep only valid rows for the target schema
    .filter(u => u.fullName && Number.isInteger(u.year) && u.year >= 1900 && u.year <= 3000 && u.units >= 0);

  // Upsert keyed by (fullName, year)
  const ops = newUnits.map(u => ({
    updateOne: {
      filter: { fullName: u.fullName, year: u.year },
      update: { $setOnInsert: u },
      upsert: true,
    },
  }));

  if (ops.length === 0) {
    migrationResults.push(`0 units migrated`);
    return;
  }

  const result = await newDB.collection("units").bulkWrite(ops);
  migrationResults.push(`${result.upsertedCount} units migrated`);
}


// ----------------------------
// EARNINGS
// ----------------------------
const EARNING_DEST = new Set(["Re-Invested", "Withdrawn"]);
const EARNING_SRC = new Set(["Permanent Savings", "Temporary Savings"]);
const EARNING_STATUS = new Set(["Sent", "Pending", "Failed"]);

// map legacy -> new enum
function normalizeEarningSource(src) {
  if (src === "Distribution") return "Permanent Savings";
  return src;
}

function transformEarning(legacy) {
  // legacy:
  // {
  //   _id:ObjectId, beneficiary_name, date_of_earning:Date,
  //   earnings_amount:Number, destination, source, status
  // }
  const fullName = (legacy?.beneficiary_name ?? "").trim();
  const _id = legacy?._id; // keep original _id
  const date = legacy?.date_of_earning instanceof Date ? legacy.date_of_earning : new Date(legacy?.date_of_earning);
  const amount = Number(legacy?.earnings_amount ?? 0);

  // enums
  const destination = EARNING_DEST.has(legacy?.destination) ? legacy.destination : "Re-Invested";
  const mappedSrc = normalizeEarningSource(legacy?.source);
  const source = EARNING_SRC.has(mappedSrc) ? mappedSrc : "Permanent Savings";
  const status = EARNING_STATUS.has(legacy?.status) ? legacy.status : "Sent";

  return {
    _id,
    fullName,
    date: isNaN(date) ? new Date() : date,
    amount: Math.max(0, Number.isFinite(amount) ? amount : 0),
    destination,
    source,
    status,
  };
}

async function migrateEarnings(oldEarnings, _oldUsers, newDB) {
  // Transform & keep sane rows
  const newEarnings = oldEarnings
    .map(transformEarning)
    .filter(e => e.fullName && e.date instanceof Date && !isNaN(e.date) && e.amount >= 0);

  const ops = newEarnings.map(e => ({
    updateOne: {
      filter: { _id: e._id }, // preserve original _id
      update: { $setOnInsert: e },
      upsert: true,
    },
  }));

  if (ops.length === 0) {
    migrationResults.push(`0 earnings migrated`);
    return;
  }

  const result = await newDB.collection("earnings").bulkWrite(ops);
  migrationResults.push(`${result.upsertedCount} earnings migrated`);
}


//perform migration
await migrateDatabase()
