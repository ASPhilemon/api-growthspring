import nodeCron from "node-cron";
import * as UserServiceManager from "./service.js"

//nodeCron.schedule('* * * * *', ()=> UserServiceManager.sendBirthdayReminder())

UserServiceManager.sendBirthdayReminder()