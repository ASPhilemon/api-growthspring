import express, { json } from "express"

//routers imports
import cashLocationRouter from "./services/cash-location-service/routes.js"
import depositRouter from "./services/deposit-service/routes.js"
import loanRouter from "./services/loan-service/routes.js"
import pointRouter from "./services/point-service/routes.js"
import userRouter from "./services/user-service/routes.js"
import withdrawRouter from "./services/withdraw-service/routes.js"

import cors from "cors"
import { errorHandler } from "./middleware/error-middleware.js"

//app
const app = express()

app.use(cors({origin: true , credentials: true}))
app.use(express.json())

//routes
app.use("/cash-locations", cashLocationRouter)
app.use("/deposits", depositRouter)
app.use("/loans", loanRouter)
app.use("/point-transactions", pointRouter)
app.use("/users", userRouter)
app.use("/withdraws", withdrawRouter)

app.get('/', (req, res)=> res.end("express server running"))

//global error-handler
app.use(errorHandler)

export default app