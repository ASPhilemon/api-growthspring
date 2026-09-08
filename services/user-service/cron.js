import nodeCron from "node-cron";
import * as UserServiceManager from "./service.js"

export function schedule(){
    nodeCron.schedule('* * * * *', UserServiceManager.sendBirthdayReminder)
}