import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import {disconnectDB} from "./db.js"
import connectDB from "./db.js"
import app from "./app.js"
import { AppError } from './utils/error-util.js';
import { sendEmail } from './services/email-service/service.js';

//connect to database
const MONGODB_URI = process.env.MONGODB_URI
await connectDB(MONGODB_URI)


//start server
const PORT = process.env.PORT
app.listen(PORT, ()=> {
  console.log(`=== Listening for requests on port ${PORT}`)
})


//handle server errors
process.on("uncaughtException", async (err) => {
  console.error("=== Uncaught Exception", err)
  //await sendErrorAlert(err.stack || err.message);
  if (!(err instanceof AppError)) await gracefulShutdown();
});

process.on("unhandledRejection", async (reason) => {
  console.error("=== Uncaught Rejection", reason)
  //await sendErrorAlert("Unhandled promise rejection occured")
  if (!(reason instanceof AppError)) await gracefulShutdown()
});

async function gracefulShutdown() {
  try {
    await disconnectDB()
    console.log("=== Cleanup complete. Exiting...");
  } catch (cleanupErr) {
    console.error("=== Error during cleanup:", cleanupErr);
  } finally {
    process.exit(1)
  }
}

async function sendErrorAlert(message) {
  const recipients = ["philemonariko@gmail.com"];

  try {
    await Promise.all(
      recipients.map((recipient) =>
        sendEmail(
          "growthspring",
          recipient,
          "Growthspring Server Error Alert",
          message
        )
      )
    );
  } catch (err) {
    console.error("=== Error sending error alert email: ", err);
  }
}