//router imports
import cashLocationRouter from "./services/cash-location-service/routes.js"
import depositRouter from "./services/deposit-service/routes.js"
//import loanRouter from "./services/loan-service/routes.js"
import pointRouter from "./services/point-service/routes.js"
import userRouter from "./services/user-service/routes.js"
import withdrawRouter from "./services/withdraw-service/routes.js"
import authRouter from "./services/auth-service/routes.js"

//middleware imports
import { registerBeforeAllMiddleware, registerAfterAllMiddleware } from "./middleware.js"

export function registerRoutes(app){
  //register beforeAll middleware
  registerBeforeAllMiddleware(app)

  app.use("/auth", authRouter)
  app.use("/users", userRouter)
  app.use("/cash-locations", cashLocationRouter)
  app.use("/deposits", depositRouter)
  //app.use("/loans", loanRouter)
  app.use("/point-transactions", pointRouter)
  app.use("/withdraws", withdrawRouter)

  //register afterAll middleware
  registerAfterAllMiddleware(app)
}

