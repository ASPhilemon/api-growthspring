import connectDB from "./db.js"
import { configDotenv } from "dotenv"
import * as UserCron from "./services/user-service/cron.js"
import { User } from "./services/user-service/models.js"

configDotenv()

//connect to database
const MONGODB_URI = process.env.MONGODB_URI
await connectDB(MONGODB_URI)

UserCron.schedule()

