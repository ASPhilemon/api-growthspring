// admin-service/club-fund-annual-transactions/controller.js
import * as ServiceManager from "./service.js";
import * as Response from "../../utils/http-response-util.js";

export async function addClubFundAnnualTransaction(req, res) {
  const tx = req.body;
  const created = await ServiceManager.addClubFundAnnualTransaction(tx);
  Response.sendSuccess(created, { req, res });
}
