import mongoose from "mongoose"
import { sendMail, closeMailTransport } from "./sendMail.mjs";
import fs from "fs"
import ejs from "ejs"

//connect to mongoDB
const MONGODB_URI = 'mongodb+srv://blaise1:blaise119976@cluster0.nmt34.mongodb.net/GrowthSpringNew?retryWrites=true&w=majority';
await mongoose.connect(MONGODB_URI)
console.log("connected to MongoDB")

async function sendDepositReminders(){
  let users = await getUsersWithoutDepositsThisMonth()
  //console.log("users", users)
  //users = [{fullName: "Ariko Stephen Philemon", email: "philemonariko@gmail.com"}]

  await Promise.all(
    users.map(async(user)=>{
      try{
        await sendMail({
          sender: "growthspring",
          recipient: user.email,
          subject: "Monthly Deposit Reminder",
          message: await renderTemplate( {name: user.fullName.split(" ").at(-1)} )
        })
        console.log(`sent email to: ${user.fullName}`)
      } catch(err){
        console.log(`Failed to send email to ${user.fullName}`)
      }
    })
  )

  closeMailTransport()

}

async function renderTemplate(context){
  const template = "./deposit-reminder.ejs"
  return new Promise((resolve, reject)=>{
    ejs.renderFile(template, context, (err, data)=> {
      if(err) throw new Error(err.message);
      resolve(data)
    })
  })
}

async function renderTemplateAndSave(context){
  context = {name: "Philemon"}
  const message = await renderTemplate(context)
  fs.writeFileSync("deposit-reminder.html", message)
}

async function getUsersWithoutDepositsThisMonth(){
  const allUsers = await getAllUsers()
  let usersWithDepositsThisMonth = await getUsersWithDepositsThisMonth()
  usersWithDepositsThisMonth = new Set(usersWithDepositsThisMonth.map((user)=>user.depositor_name))

  const usersWithoutDepositsThisMonth = allUsers.filter((user)=>{
    return !usersWithDepositsThisMonth.has(user.fullName)
  })

  return usersWithoutDepositsThisMonth
}

async function getUsersWithDepositsThisMonth(){
  const now = new Date();
  const thisMonthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const users = await mongoose.connection.db.collection("deposits").find(
    {deposit_date: {$gte: thisMonthStartDate}},
    {projection: {depositor_name: 1, _id: 0}}
  ).toArray()

  return users
}

async function getAllUsers(){
  const users = await mongoose.connection.db.collection("users").find(
    {},
    {projection: {fullName: 1, email: 1, _id: 0}}
  ).toArray()

  return users
}


// await renderTemplateAndSave()
await sendDepositReminders()







await mongoose.disconnect()