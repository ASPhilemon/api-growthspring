// admin-service/club-fund-annual-transactions/routes.js
import express from "express";

import * as RouteController from "./controller.js";
import { requireAdmin } from "../../middleware.js";

const router = express.Router();

router.use(requireAdmin);

// Club Fund Annual Transactions routes (for now: add only)
router.post("/", RouteController.addClubFundAnnualTransaction);

export default router;
