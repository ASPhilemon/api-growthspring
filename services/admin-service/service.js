import { ClubFundAnnualTransaction } from "./models.js";

// util
import * as Errors from "../../utils/error-util.js";
import * as DB from "../../utils/db-util.js";
import * as Validator from "../../utils/validator-util.js";

//import * as Schemas from "./schemas.js";

// cash location service (used to resolve account name during transformation)
import * as CashLocationService from "../cash-location-service/service.js";

/**
 * Create a new club fund transaction record.
 * New records should include `account` (cash-location ObjectId).
 */
export async function addClubFundAnnualTransaction(tx) {
  // expected tx fields:
  // { transaction_type, name, amount, reason, date, account? }
  //Validator.schema(Schemas.addClubFundAnnualTransaction, tx);

  // basic safety (optional—validation should already cover most)
  if (!tx?.transaction_type) throw new Errors.BadRequestError("transaction_type is required");
  if (!tx?.name) throw new Errors.BadRequestError("name is required");
  if (!Number.isFinite(Number(tx?.amount)) || Number(tx.amount) < 0) {
    throw new Errors.BadRequestError("amount must be a non-negative number");
  }
  if (!tx?.reason) throw new Errors.BadRequestError("reason is required");
  if (!tx?.date) throw new Errors.BadRequestError("date is required");

  // if account provided, ensure it exists (so FE can resolve it)
  if (tx.account) {
    // relies on cash-location service throwing NotFoundError if not found
    await CashLocationService.getCashLocationById(tx.account);
  }

  const created = await DB.query(ClubFundAnnualTransaction.create({
    transaction_type: tx.transaction_type,
    name: tx.name,
    amount: Number(tx.amount),
    reason: tx.reason,
    date: tx.date,
    account: tx.account || undefined,
  }));

  return created;
}

/**
 * Fetch all club fund transactions (raw list).
 */
export async function getClubFundAnnualTransactions() {
  return await DB.query(ClubFundAnnualTransaction.find().sort({ date: 1 }));
}

export async function toAnnualSummariesForFrontend(transactions = null) {
  const items = Array.isArray(transactions) ? transactions : await getClubFundAnnualTransactions();

  const accountIds = Array.from(
    new Set(
      items
        .map((t) => t?.account)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

  const accountNameById = {};
  if (accountIds.length) {
    const resolved = await Promise.all(
      accountIds.map(async (id) => {
        try {
          const cashLoc = await CashLocationService.getCashLocationById(id);
          return [id, cashLoc?.name || "Unavailable"];
        } catch {
          return [id, "Unavailable"];
        }
      })
    );
    resolved.forEach(([id, name]) => {
      accountNameById[id] = name;
    });
  }

  const out = {};
  for (const t of items) {
    const d = new Date(t?.date);
    const year = !Number.isNaN(d.getTime()) ? String(d.getFullYear()) : "Unknown";

    if (!out[year]) out[year] = { records: [] };

    const accountName = t?.account ? (accountNameById[String(t.account)] || "Unavailable") : "Unavailable";
    const isExpense = String(t?.transaction_type || "").toLowerCase() === "expense";

    out[year].records.push({
      date: t?.date,
      name: String(t?.name || ""),
      reason: String(t?.reason || ""),
      amount: Number(t?.amount || 0),
      account: accountName,
      isOutflow: isExpense,
    });
  }

  const yearsSorted = Object.keys(out)
    .filter((y) => /^\d{4}$/.test(y))
    .sort((a, b) => Number(a) - Number(b));

  const nonNumericYears = Object.keys(out).filter((y) => !/^\d{4}$/.test(y)).sort();
  const ordered = {};

  [...yearsSorted, ...nonNumericYears].forEach((y) => {
    ordered[y] = out[y];
    ordered[y].records.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (Number.isNaN(da) && Number.isNaN(db)) return 0;
      if (Number.isNaN(da)) return 1;
      if (Number.isNaN(db)) return -1;
      return da - db;
    });
  });
  return ordered;
}

