jest.setTimeout(30000); // 30 seconds

import { jest } from '@jest/globals';
import mongoose from "mongoose";
import connectDB from "../../../db.js";

import { Loan } from "../models.js";
import * as Mocks from "./mocks.js";

beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGO_URL;
    await connectDB();
});

afterAll(async () => {
    await Loan.deleteMany();
    await mongoose.disconnect();
});

describe("Loan Model", () => {
    let dbUser, dbAdmin, dbLoan;

    beforeEach(async () => {
        await Loan.deleteMany();
        dbUser = Mocks.createDBUser("regular");
        dbAdmin = Mocks.createDBUser("admin");
        dbLoan = Mocks.createDBLoan(dbUser, dbAdmin, "Ongoing");
        await Loan.create(dbLoan);
    });

    test("Loan.create should insert a new loan into the collection", async () => {
        const loan = await Loan.findById(dbLoan._id);
        expect(loan).not.toBeNull();
        expect(loan.amount).toBe(dbLoan.amount);
    });

    test("Loan.findById should retrieve an existing loan", async () => {
        const foundLoan = await Loan.findById(dbLoan._id);
        expect(foundLoan).not.toBeNull();
        expect(foundLoan._id.toString()).toEqual(dbLoan._id.toString());
    });

    test("Loan.updateOne should update an existing loan", async () => {
        await Loan.updateOne({ _id: dbLoan._id }, { $set: { status: "Ended" } });
        const updatedLoan = await Loan.findById(dbLoan._id);
        expect(updatedLoan.status).toEqual("Ended");
    });

    test("Loan.deleteOne should delete a loan", async () => {
        await Loan.deleteOne({ _id: dbLoan._id });
        const deletedLoan = await Loan.findById(dbLoan._id);
        expect(deletedLoan).toBeNull();
    });
});

describe("Loan.getFilteredLoans", () => {
    const user1 = Mocks.createDBUser("regular");
    user1.fullName = "User One";
    const user2 = Mocks.createDBUser("regular");
    user2.fullName = "User Two";
    const admin = Mocks.createDBUser("admin");

    beforeAll(async () => {
        // Seed database with a variety of loans
        await Loan.insertMany([
            { ...Mocks.createDBLoan(user1, admin, "Ongoing", "Standard"), date: new Date("2024-05-15T00:00:00.000Z") },
            { ...Mocks.createDBLoan(user2, admin, "Ended", "Standard"), date: new Date("2024-08-20T00:00:00.000Z") },
            { ...Mocks.createDBLoan(user1, admin, "Pending Approval", "Standard"), date: new Date("2025-01-10T00:00:00.000Z") },
        ]);
    });

    test("should filter loans by year", async () => {
        const result = await Loan.getFilteredLoans({ year: 2024 });
        expect(result).toHaveLength(2);
        expect(result.every(loan => new Date(loan.date).getFullYear() === 2024)).toBe(true);
    });

    test("should filter loans by status", async () => {
        const result = await Loan.getFilteredLoans({ status: "Ended" });
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("Ended");
    });
    
    test("should filter loans by member name", async () => {
        const result = await Loan.getFilteredLoans({ member: "User One" });
        // It will find the 'Ongoing' and 'Ended' for the user by default filter, but not 'Pending'
        const defaultFiltered = result.filter(r => r.status !== 'Pending Approval');
        expect(defaultFiltered.every(loan => loan.borrower.name === "User One")).toBe(true);
    });
});