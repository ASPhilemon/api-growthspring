import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import connectDB from "./db.js"
import app from "./app.js"

//load environemnt variables 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = process.env.NODE_ENV === "production"?
".env.production" :
".env"
const ENV_FILE_PATH = path.join(__dirname, ENV_FILE)
if (!fs.existsSync(ENV_FILE_PATH)) {
  throw new Error(`Environment file not found: ${ENV_FILE_PATH}`);
}
dotenv.config({ path: ENV_FILE_PATH, override: true})


//connect to database
const MONGODB_URI = process.env.MONGODB_URI
await connectDB(MONGODB_URI)


//start server
const PORT = process.env.PORT
app.listen(PORT, ()=> {
  console.log(`Listening for requests on port ${PORT}`)
})
