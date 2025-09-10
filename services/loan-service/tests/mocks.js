import { v4 as uuid } from "uuid";
import { faker } from "@faker-js/faker";
import * as UserMocks from "../../user-service/__tests__/mocks.js";
import * as CashLocationMocks from "../cash-location-service/__tests__/mocks.js";
import mongoose from "mongoose";

const MIN_DATE = "2023-01-01";
const MAX_DATE = "2024-12-31";

export function generateDBLoan(options = {}) {
  const {
    borrower,
    initiatedBy,
    approvedBy,
    status = faker.helpers.arrayElement(["Pending Approval", "Ongoing", "Ended", "Cancelled"]),
    type = faker.helpers.arrayElement(["Standard", "Interest-Free"]),
  } = options;

  const loanBorrower = borrower || UserMocks.generateDBUser();
  const loanInitiatedBy = initiatedBy || UserMocks.generateDBUser();
  const loanApprovedBy = approvedBy || (status !== "Pending Approval" ? UserMocks.generateDBUser() : {});

  const amount = faker.number.int({ min: 1000, max: 1000000 });
  const duration = faker.number.int({ min: 1, max: 36 });
  const date = faker.date.between({ from: MIN_DATE, to: MAX_DATE });

  const sources = Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => {
    const cashLocation = CashLocationMocks.generateInputCashLocation();
    return {
      id: new mongoose.Types.ObjectId(cashLocation._id),
      name: cashLocation.name,
      amount: faker.number.int({ min: 100, max: amount }),
    };
  });

  const payments = Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => {
    const updatedBy = UserMocks.generateDBUser();
    const location = CashLocationMocks.generateInputCashLocation();
    return {
      date: faker.date.between({ from: date, to: new Date() }),
      amount: faker.number.int({ min: 100, max: 10000 }),
      updatedBy: { id: updatedBy._id, name: updatedBy.fullName },
      location: new mongoose.Types.ObjectId(location._id),
    };
  });

  return {
    _id: new mongoose.Types.ObjectId(),
    duration,
    rate: faker.number.float({ min: 0.01, max: 0.3, precision: 0.01 }),
    earliestDate: faker.date.between({ from: MIN_DATE, to: MAX_DATE }),
    latestDate: faker.date.between({ from: MIN_DATE, to: MAX_DATE }),
    type,
    status,
    initiatedBy: { id: loanInitiatedBy._id, name: loanInitiatedBy.fullName },
    approvedBy: loanApprovedBy.id ? { id: loanApprovedBy._id, name: loanApprovedBy.fullName } : {},
    worthAtLoan: amount,
    amount,
    date,
    borrower: { id: loanBorrower._id, name: loanBorrower.fullName },
    pointsSpent: faker.number.int({ min: 0, max: 1000 }),
    principalLeft: amount,
    lastPaymentDate: date,
    units: faker.number.int({ min: 0, max: 100000 }),
    rateAfterDiscount: faker.number.float({ min: 0.01, max: 0.3, precision: 0.01 }),
    discount: faker.number.int({ min: 0, max: 100 }),
    pointsWorthBought: faker.number.int({ min: 0, max: 1000 }),
    pointsAccrued: faker.number.int({ min: 0, max: 1000 }),
    interestAccrued: faker.number.int({ min: 0, max: 10000 }),
    interestAmount: faker.number.int({ min: 0, max: 10000 }),
    installmentAmount: Math.round(amount / duration),
    sources,
    payments,
  };
}

export function generateDBLoans(options = {}) {
  const { numberOfLoans = 10, borrowers } = options;
  let loanBorrowers = borrowers || UserMocks.generateDBUsers({ numberOfUsers: 5 });

  const dbLoans = [];
  let recordedLoanDates = new Set();

  for (let i = 0; i < numberOfLoans; ) {
    let borrower = faker.helpers.arrayElement(loanBorrowers);
    let dbLoan = generateDBLoan({ borrower });
    let dateIso = dbLoan.date.toISOString();
    if (!recordedLoanDates.has(dateIso)) {
      dbLoans.push(dbLoan);
      recordedLoanDates.add(dateIso);
      i++;
    }
  }

  return dbLoans;
}
//npm test -- services/loan-service/tests/service.test.js