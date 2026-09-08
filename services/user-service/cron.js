import nodeCron from "node-cron";
import * as UserServiceManager from "./service.js"

export function schedule(){
    // Runs every day at 7:00 AM UTC
    nodeCron.schedule('22 22 * * *', UserServiceManager.sendBirthdayReminder, {timezone: 'UTC'})
}