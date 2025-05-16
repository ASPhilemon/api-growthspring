/*imports*/

import express from "express"

//routers
import cashLocationRouter from "./services/cash-location-service/routes.js"
import depositRouter from "./services/deposit-service/routes.js"
import loanRouter from "./services/loan-service/routes.js"
import pointRouter from "./services/point-service/routes.js"
import userRouter from "./services/user-service/routes.js"
import withdrawRouter from "./services/withdraw-service/routes.js"
//cors
import cors from "cors"

//app
const app = express()

//global middleware
app.use(cors({origin: true , credentials: true}))

//routes
app.use("/cash-locations", cashLocationRouter)
app.use("/deposits", depositRouter)
app.use("/loans", loanRouter)
app.use("/points/transfers", pointRouter)
app.use("/users", userRouter)
app.use("/withdraws", withdrawRouter)

app.get('/', (req, res)=> res.end("express server running"))

export default app