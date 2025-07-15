import app from "./app.js"
import dotenv from "dotenv"
import connectDB from "./db.js"

dotenv.config()

const PORT = process.env.PORT

await connectDB()

app.listen(PORT, ()=> {
  console.log(`Listening for requests on port ${PORT}`)
})
