import app from "./app.js"
import dotenv from "dotenv"
import connectDB from "./db.js"

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error("MONGODB_URI environemnt variable is missing")

await connectDB(MONGODB_URI)


const PORT = process.env.PORT
app.listen(PORT, ()=> {
  console.log(`Listening for requests on port ${PORT}`)
})
