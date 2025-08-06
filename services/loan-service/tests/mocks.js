
import { jest } from '@jest/globals';
import { v4 as uuid } from "uuid";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

/**
 * Creates a mock user object for testing purposes.
 * @param {string} userType - Can be 'regular' or 'admin'.
 * @returns {object} A mock user object.
 */
export function createDBUser(userType) {
  const userId = new ObjectId().toString();
  return {
    _id: userId,
    id: userId, // For convenience since service uses both
    fullName: "John Doe",
    investmentAmount: 5_000_000,
    points: 10000,
    email: "johndoe@example.com",
    phoneContact: "0712345678",
    isAdmin: userType === "admin",
    // For Interest-Free Loan logic
    temporaryInvestment: {
        amount: 1_000_000,
        units: 50_000_000, // Represents (amount * days)
        unitsDate: new Date("2025-05-01T00:00:00.000Z"),
    }
  };
}


/**
 * Creates a mock cash location object.
 * @returns {object} A mock cash location.
 */
export function createDBCashLocation() {
    return {
        _id: new ObjectId().toString(),
        name: "Main Vault",
        amount: 10_000_000
    };
}

/**
 * Creates a detailed mock loan object for database simulation.
 * @param {object} borrower - The mock borrower user object.
 * @param {object} initiator - The mock user who initiated the loan.
 * @param {string} status - The loan's status (e.g., 'Pending Approval', 'Ongoing').
 * @param {string} type - The loan's type (e.g., 'Standard', 'Interest-Free').
 * @returns {object} A mock loan object.
 */
export function createDBLoan(borrower, initiator, status = "Ongoing", type = "Standard") {
    const loanId = new ObjectId().toString();
    const loanAmount = 500_000;

    return {
        _id: loanId,
        id: loanId,
        amount: loanAmount,
        duration: 12, // months
        rate: 5, // percent
        type,
        status,
        earliestDate: new Date("2025-07-01T00:00:00.000Z"),
        latestDate: new Date("2025-07-15T00:00:00.000Z"),
        date: new Date("2025-07-10T00:00:00.000Z"), // Disbursement date
        borrower: {
            id: borrower._id,
            name: borrower.fullName,
        },
        initiatedBy: {
            id: initiator._id,
            name: initiator.fullName,
        },
        approvedBy: {
            id: initiator._id,
            name: initiator.fullName,
        },
        principalLeft: loanAmount,
        lastPaymentDate: new Date("2025-07-10T00:00:00.000Z"),
        interestAmount: (loanAmount * 5) / 100,
        installmentAmount: (loanAmount * 1.05) / 12,
        worthAtLoan: borrower.investmentAmount,
        units: 0,
        interestAmountPaid: 0,
        sources: [{...createDBCashLocation(), amount: loanAmount }],
        payments: [],
    };
}

/**
 * Creates a mock input object for initiating a loan.
 * @param {string} borrowerId - The ID of the borrower.
 * @returns {object} A mock loan initiation input object.
 */
export function createLoanInitiationInput(borrowerId) {
    return {
        amount: 500_000,
        duration: 12,
        earliestDate: new Date("2025-07-01T00:00:00.000Z"),
        latestDate: new Date("2025-07-15T00:00:00.000Z"),
        borrowerId,
        loanType: "Standard",
    };
}

//npm test -- services/loan-service/tests/service.test.js