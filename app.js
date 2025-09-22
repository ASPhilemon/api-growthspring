import express from "express"
import { registerRoutes } from "./routes.js"

const app = express()

registerRoutes(app)

export default app