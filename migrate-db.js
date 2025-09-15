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
  const oldDB = (await clientOldDB.connect()).db(OLD_DB_NAME)

  console.log(`connecting to new database, [${NEW_DB_NAME}] ...`)
  const newDB = (await clientNewDB.connect()).db(NEW_DB_NAME)

  //Drop New Database 
  const dropDB = process.argv.includes("-d");
  if(dropDB){
    console.log("dropping new database ...")
    await newDB.dropDatabase();
  }

  const [oldUsers, oldDeposits, oldLoans] = await Promise.all([
    oldDB.collection("users").find().toArray(),
    oldDB.collection("deposits").find().toArray(),
    oldDB.collection("loans").find().toArray(),
  ])

  await migrateUsers(oldUsers, newDB)
  await migrateDeposits(oldUsers, oldDeposits, newDB)
  await migrateLoans(oldDB, newDB)

  console.log("\nDATABASE MIGRARTION  SUCCEEDED ✔ ")
  migrationResults.forEach((result)=>console.log(result))
  await clientOldDB.close()
  await clientNewDB.close()
}

async function migrateUsers(oldUsers, newDB){
  console.log("migrating users ...")

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
  console.log("migrating Deposits ...")
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

async function migrateLoans(oldDB, newDB){
  console.log("migrating Loans ...")
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

//perform migration
await migrateDatabase()
