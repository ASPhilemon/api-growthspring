import nodeCron from "node-cron";
import * as UserServiceManager from "./service.js"

export function schedule(){
    // Runs every day at 7:00 HRS(7AM) AM UTC => 10AM EAT
    nodeCron.schedule('0 7 * * *', ()=>{
        UserServiceManager.sendBirthdayReminder()
        console.log("Birthday Reminder Executed ...")
    },{timezone: 'UTC'})
}