import { jest } from '@jest/globals';
import mongoose from "mongoose";

import { Loan } from "../models.js";
import * as Mocks from "./mocks.js";
import * as UserMocks from "../../user-service/__tests__/mocks.js";
import { User } from "../../user-service/models.js";
import connectDB from '../../../db.js';

beforeAll(async () => {
  const MONGODB_URI = globalThis.__MONGO_URI__;
  await connectDB(MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Loan Model: Write Operations", () => {
  let borrower, loan;

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    borrower = UserMocks.generateDBUser();
    await User.create(borrower);
    loan = Mocks.generateDBLoan({ borrower });
    await Loan.create(loan);
  });

  test("Loan.create should insert a new loan in collection", async () => {
    const insertedLoan = await Loan.findById(loan._id);
    expect(insertedLoan).not.toBe(null);
  });

  test("Loan.updateOne should update existing loan", async () => {
    await Loan.updateOne({ _id: loan._id }, { $set: { amount: 1000 } });
    let updatedLoan = await Loan.findById(loan._id);
    expect(updatedLoan.amount).toEqual(1000);
  });

  test("Loan.deleteOne should delete loan", async () => {
    await Loan.deleteOne({ _id: loan._id });
    const deletedLoan = await Loan.findById(loan._id);
    expect(deletedLoan).toBe(null);
  });
});

describe("Loan Model: Loan.getFilteredLoans", () => {
  let numberOfBorrowers = 2;
  let numberOfLoans = 50;
  let borrowers = UserMocks.generateDBUsers({ numberOfUsers: numberOfBorrowers });
  let loans = Mocks.generateDBLoans({ numberOfLoans, borrowers });

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    await User.insertMany(borrowers);
    await Loan.insertMany(loans);
  }, 20000);

  test("no args - should return loans with status Ended or Ongoing, sorted by date desc, first 20", async () => {
    let defaultPerPage = 20;
    let expectedLoansIds = [...loans]
      .filter(loan => loan.status === "Ended" || loan.status === "Ongoing")
      .sort((a, b) => b.date - a.date)
      .slice(0, defaultPerPage)
      .map(loan => loan._id.toString());

    let actualLoansIds = (await Loan.getFilteredLoans({}))
      .map(loan => loan._id.toString());

    expect(actualLoansIds).toEqual(expectedLoansIds);
  });

  test("all args passed - should return the loans based on the filter, sort, and page", async () => {
    let member = borrowers[0]._id.toString();
    let year = 2024;
    let month = 1;
    let status = "Ongoing";
    let sortBy = "date";
    let order = 1;
    let page = 1;

    let expectedLoansIds = [...loans]
      .filter((loan) => {
        const loanYear = new Date(loan.date).getUTCFullYear();
        const loanMonth = new Date(loan.date).getUTCMonth() + 1;
        return loanYear === year && 
          loanMonth === month &&
          loan.borrower.id.toString() === member &&
          loan.status === status;
      })
      .sort((a, b) => order * (a[sortBy] - b[sortBy]))
      .slice(0, 20)
      .map(loan => loan._id.toString());

    let actualLoansIds = (await Loan.getFilteredLoans({ member, year, month, status, sortBy, order, page }))
      .map(loan => loan._id.toString());

    expect(actualLoansIds).toEqual(expectedLoansIds);
  });

  test("status Overdue - should return overdue ongoing loans", async () => {
    let overdueBorrower = UserMocks.generateDBUser();
    await User.create(overdueBorrower);
    let overdueLoan = Mocks.generateDBLoan({ borrower: overdueBorrower, status: "Ongoing" });
    overdueLoan.date = new Date("2024-01-01");
    overdueLoan.duration = 6;
    await Loan.create(overdueLoan);

    let notOverdueLoan = Mocks.generateDBLoan({ borrower: overdueBorrower, status: "Ongoing" });
    notOverdueLoan.date = new Date("2025-01-01");
    notOverdueLoan.duration = 12;
    await Loan.create(notOverdueLoan);

    let result = await Loan.getFilteredLoans({ status: "Overdue" });

    expect(result.map(l => l._id.toString())).toContain(overdueLoan._id.toString());
    expect(result.map(l => l._id.toString())).not.toContain(notOverdueLoan._id.toString());
  });

  test("member as name - should filter by borrower.name", async () => {
    let member = borrowers[0].fullName;
    let expectedIds = loans
      .filter(l => l.borrower.name === member)
      .sort((a, b) => b.date - a.date)
      .slice(0, 20)
      .map(l => l._id.toString());

    let result = await Loan.getFilteredLoans({ member });
    let actualIds = result.map(l => l._id.toString());
    expect(actualIds).toEqual(expectedIds);
  });
});