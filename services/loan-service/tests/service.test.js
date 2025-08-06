
import mongoose from 'mongoose';
import * as Mocks from "./mocks.js";
import { jest } from '@jest/globals';
import * as Errors from '../../../utils/error-util.js';

// In service.test.js, at the top with the other mocks

jest.unstable_mockModule('../service.js', async () => {
    const originalModule = await jest.importActual('../service.js');
    return {
      __esModule: true, // Important for ES Modules
      ...originalModule, // Use all the real functions from the original module
    };
  });


// Mock Dependencies
jest.unstable_mockModule('../models.js', () => ({
    Loan: {
        findById: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        updateOne: jest.fn(),
        deleteOne: jest.fn(),
        getFilteredLoans: jest.fn(),
        save: jest.fn(),
    },
}));

jest.unstable_mockModule('../../../utils/db-util.js', () => ({
    query: jest.fn(promise => promise),
    tryMongoose: jest.fn(promise => promise),
}));

jest.unstable_mockModule('../../../utils/validator-util.js', () => ({
    assert: jest.fn((condition, message, errorOptions) => {
        if (!condition) {
            throw new Errors.AppError(message, errorOptions?.statusCode || 400);
        }
    }),
    required: jest.fn(),
}));

jest.unstable_mockModule('../../../services/user-service/service.js', () => ({
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    addTemporaryInvestmentUnits: jest.fn(),
    setTemporaryInvestmentUnitsDate: jest.fn(),
}));

jest.unstable_mockModule('../../../utils/date-util.js', () => ({
    getDaysDifference: jest.fn((date1, date2) => {
        const diffTime = Math.abs(new Date(date2) - new Date(date1));
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }),
}));

jest.unstable_mockModule('../../../src/config/constants.js', () => ({
    default: {
        MONTHLY_LENDING_RATE: 2.5,
        POINTS_VALUE_PER_UNIT: 1000,
        INTEREST_MULTIPLIER_RULES: {
            minMultiplier: 0.75,
            maxMultiplier: 1.5,
            minInterestRatio: 0.05,
            maxInterestRatio: 0.20,
        },
        MIN_EXCESS_DEPOSIT_THRESHOLD: 1000,
    },
}));

jest.unstable_mockModule('../../../services/cash-location-service/service.js', () => ({
    addToCashLocation: jest.fn(),
}));

jest.unstable_mockModule('../../../services/point-service/service.js', () => ({
    redeemPoints: jest.fn(),
}));

jest.unstable_mockModule('../../../services/email-service/service.js', () => ({
    sendEmailWithTemplate: jest.fn(),
}));

jest.unstable_mockModule('../../../services/deposit-service/service.js', () => ({
    createDeposit: jest.fn(),
}));

// Import module to test
const ServiceManager = await import("../service.js");
const { Loan } = await import("../models.js");
const DB = await import("../../../utils/db-util.js");
const Validator = await import("../../../utils/validator-util.js");
const UserServiceManager = await import('../../user-service/service.js');
const CashLocationServiceManager = await import('../../cash-location-service/service.js');
const EmailServiceManager = await import('../../email-service/service.js');
const Constants = (await import("../../../src/config/constants.js")).default;

beforeEach(() => {
    jest.clearAllMocks();
});


//....................................GENERAL_REQUESTS.....................................

describe("getLoans", () => {
    test("should call Loan.getFilteredLoans with the correct parameters", async () => {
        const args = { filter: { year: 2025 }, sort: { date: -1 }, pagination: { page: 1 } };
        await ServiceManager.getLoans(args);
        expect(Loan.getFilteredLoans).toHaveBeenCalledWith(args);
    });
});

describe("getLoanById", () => {
    test("should call Loan.findById and return the loan", async () => {
        const fakeLoan = Mocks.createDBLoan(Mocks.createDBUser(), Mocks.createDBUser());
        fakeLoan.save = jest.fn().mockResolvedValue(fakeLoan);
        Loan.findById.mockResolvedValue(fakeLoan);
        const result = await ServiceManager.getLoanById(fakeLoan._id);

        expect(Loan.findById).toHaveBeenCalledWith(fakeLoan._id);
        expect(DB.query).toHaveBeenCalledWith(Loan.findById(fakeLoan._id));
        expect(result).toEqual(fakeLoan);
    });

    test("should throw an AppError if the loan is not found", async () => {
        Loan.findById.mockResolvedValue(null);
        const loanId = new mongoose.Types.ObjectId().toString();

        await expect(ServiceManager.getLoanById(loanId)).rejects.toThrow(Errors.AppError);
        expect(Validator.assert).toHaveBeenCalledWith(null, "Loan not found.", expect.any(Object));
    });
});

describe("getLoanPayments", () => {
    test("should return the payments array of a loan", async () => {
        const fakeLoan = Mocks.createDBLoan(Mocks.createDBUser(), Mocks.createDBUser());
        fakeLoan.save = jest.fn().mockResolvedValue(fakeLoan);
        fakeLoan.payments = [{ _id: "payment1", amount: 100 }];
        Loan.findById.mockResolvedValue(fakeLoan);
        
        const payments = await ServiceManager.getLoanPayments(fakeLoan._id);
        
        expect(payments).toEqual(fakeLoan.payments);
    });
});

describe("getLoanPayment", () => {
    test("should retrieve a specific payment from a loan", async () => {
        const paymentId = new mongoose.Types.ObjectId().toString();
        const fakeLoan = Mocks.createDBLoan(Mocks.createDBUser(), Mocks.createDBUser());
        fakeLoan.save = jest.fn().mockResolvedValue(fakeLoan);
        // For this test, mock the Mongoose sub-document .id() method
        fakeLoan.payments = {
            id: jest.fn().mockReturnValue({ _id: paymentId, amount: 50000 })
        };
        Loan.findById.mockResolvedValue(fakeLoan);

        const payment = await ServiceManager.getLoanPayment(fakeLoan._id, paymentId);
        
        expect(fakeLoan.payments.id).toHaveBeenCalledWith(paymentId);
        expect(payment).toBeDefined();
        expect(payment._id).toBe(paymentId);
    });
});

describe("initiateLoan (Dispatcher)", () => {
    let borrowerUser, currentUser, loanInput;

    beforeEach(() => {
        borrowerUser = Mocks.createDBUser("regular");
        currentUser = Mocks.createDBUser("admin");
        loanInput = Mocks.createLoanInitiationInput(borrowerUser._id);
        UserServiceManager.getUserById.mockResolvedValue(borrowerUser);
        
        // Use spyOn to mock the internal functions for this test
        jest.spyOn(ServiceManager, 'initiateStandardLoanRequest').mockResolvedValue({ _id: 'newloan123' });
        jest.spyOn(ServiceManager, 'initiateFreeLoanRequest').mockResolvedValue({ _id: 'newloan456' });
    });

    test("should dispatch to initiateStandardLoanRequest for 'Standard' type", async () => {
        await ServiceManager.initiateLoan(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate, 
            loanInput.borrowerId, currentUser, "Standard"
        );
        expect(ServiceManager.initiateStandardLoanRequest).toHaveBeenCalledWith(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate, 
            borrowerUser, currentUser
        );
    });

    test("should dispatch to initiateFreeLoanRequest for 'Interest-Free' type", async () => {
        await ServiceManager.initiateLoan(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate,
            loanInput.borrowerId, currentUser, "Interest-Free"
        );
        expect(ServiceManager.initiateFreeLoanRequest).toHaveBeenCalledWith(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate,
            borrowerUser, currentUser
        );
    });

    test("should throw an error for an unsupported loan type", async () => {
        await expect(ServiceManager.initiateLoan(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate, 
            loanInput.borrowerId, currentUser, "UnsupportedType"
        )).rejects.toThrow(Errors.AppError);
    });
});

describe("approveLoan (Dispatcher)", () => {
    let pendingLoan, approver, sources;

    beforeEach(() => {
        const borrower = Mocks.createDBUser("regular");
        approver = Mocks.createDBUser("admin");
        pendingLoan = Mocks.createDBLoan(borrower, approver, "Pending Approval");
        sources = [{ id: new mongoose.Types.ObjectId().toString(), amount: 500000 }];

        Loan.findById.mockResolvedValue(pendingLoan);
        UserServiceManager.getUserById.mockResolvedValue(borrower);

        // Use spyOn to mock the internal approval functions
        jest.spyOn(ServiceManager, 'approveStandardLoanRequest').mockResolvedValue({ status: "Ongoing" });
        jest.spyOn(ServiceManager, 'approveFreeLoanRequest').mockResolvedValue({ status: "Ongoing" });
    });

    test("should dispatch to approveStandardLoanRequest for a 'Standard' loan", async () => {
        await ServiceManager.approveLoan(pendingLoan._id, approver, sources);
        expect(ServiceManager.approveStandardLoanRequest).toHaveBeenCalledWith(pendingLoan, approver, sources, expect.any(Object));
    });

    test("should dispatch to approveFreeLoanRequest for an 'Interest-Free' loan", async () => {
        pendingLoan.type = "Interest-Free";
        ServiceManager.approveFreeLoanRequest.mockResolvedValue({ status: "Ongoing" });
        await ServiceManager.approveLoan(pendingLoan._id, approver, sources);
        expect(ServiceManager.approveFreeLoanRequest).toHaveBeenCalledWith(pendingLoan, approver, sources, expect.any(Object));
    });

    test("should throw an error if the loan is not 'Pending Approval'", async () => {
        pendingLoan.status = "Ongoing";
        await expect(ServiceManager.approveLoan(pendingLoan._id, approver, sources)).rejects.toThrow(Errors.AppError);
    });
});

describe("cancelLoanRequest", () => {
    test("should cancel a loan that is in 'Pending Approval' status", async () => {
        const fakeLoan = Mocks.createDBLoan(Mocks.createDBUser(), Mocks.createDBUser(), "Pending Approval");
        Loan.findById.mockResolvedValue(fakeLoan);
        
        // Use spyOn to mock the internal update function for this test
        jest.spyOn(ServiceManager, 'updateLoanRecord').mockResolvedValue({ matchedCount: 1 });
        
        const result = await ServiceManager.cancelLoanRequest(fakeLoan._id);

        expect(ServiceManager.updateLoanRecord).toHaveBeenCalledWith(fakeLoan._id, { status: "Cancelled" });
        expect(result.msg).toBe('Loan request cancelled successfully.');
    });

    test("should throw an error if the loan is not 'Pending Approval'", async () => {
        const fakeLoan = Mocks.createDBLoan(Mocks.createDBUser(), Mocks.createDBUser(), "Ongoing");
        fakeLoan.save = jest.fn().mockResolvedValue(fakeLoan);
        Loan.findById.mockResolvedValue(fakeLoan);
        
        await expect(ServiceManager.cancelLoanRequest(fakeLoan._id)).rejects.toThrow(Errors.AppError);
        expect(Validator.assert).toHaveBeenCalledWith(false, "Only 'Pending Approval' loans can be cancelled.", expect.any(Object));
    });
});

describe("processLoanPayment (Dispatcher)", () => {
    let standardLoan, freeLoan, currentUser;
    beforeEach(() => {
        const borrower = Mocks.createDBUser();
        currentUser = Mocks.createDBUser("admin");
        standardLoan = Mocks.createDBLoan(borrower, currentUser, "Ongoing", "Standard");
        freeLoan = Mocks.createDBLoan(borrower, currentUser, "Ongoing", "Interest-Free");
        UserServiceManager.getUserById.mockResolvedValue(borrower);

        // Use spyOn to mock the internal payment functions
        jest.spyOn(ServiceManager, 'processStandardLoanPayment').mockResolvedValue("");
        jest.spyOn(ServiceManager, 'processFreeLoanPayment').mockResolvedValue("");
    });

    test("should dispatch to processStandardLoanPayment for 'Standard' type", async () => {
        Loan.findById.mockResolvedValue(standardLoan);
        await ServiceManager.processLoanPayment(standardLoan._id, 50000, new mongoose.Types.ObjectId().toString(), currentUser, new Date());
        expect(ServiceManager.processStandardLoanPayment).toHaveBeenCalled();
    });

    test("should dispatch to processFreeLoanPayment for 'Interest-Free' type", async () => {
        Loan.findById.mockResolvedValue(freeLoan);
        await ServiceManager.processLoanPayment(freeLoan._id, 50000, new mongoose.Types.ObjectId().toString(), currentUser, new Date());
        expect(ServiceManager.processFreeLoanPayment).toHaveBeenCalled();
    });
});


//.......................GENERAL_HELPER_FUNCTIONS..............................
describe("General and Shared Helpers", () => {
    test("createAndPersistLoan should call Loan.create with correct data", async () => {
        const user = Mocks.createDBUser();
        const params = {
            amount: 100, duration: 2, earliestDate: new Date(), latestDate: new Date(),
            borrowerUser: user, currentUser: user, rate: 5, type: "Standard",
            loanUnits: 0, interestAmount: 5, installmentAmount: 52.5, pointsSpent: 0, rateAfterDiscount: 5
        };
        await ServiceManager.createAndPersistLoan(params);
        expect(Loan.create).toHaveBeenCalledWith(expect.objectContaining({
            amount: 100,
            type: "Standard",
            status: "Pending Approval"
        }));
    });

    test("calculateTotalMonthsDue should respect grace period", () => {
        Constants.GRACE_PERIOD_DAYS = 5;
        // 34 days = 1 month + 4 days (within grace period) -> should be 1 month
        let months = ServiceManager.calculateTotalMonthsDue(new Date("2025-01-01"), new Date("2025-02-04"));
        expect(months).toBe(1);

        // 36 days = 1 month + 6 days (outside grace period) -> should be 2 months
        months = ServiceManager.calculateTotalMonthsDue(new Date("2025-01-01"), new Date("2025-02-06"));
        expect(months).toBe(2);
    });

    test("updateUserPointsBalance should call service to update user points", async () => {
        await ServiceManager.updateUserPointsBalance('user123', -50);
        expect(UserServiceManager.updateUser).toHaveBeenCalledWith('user123', { $inc: { "points": -50 } });
        
        jest.clearAllMocks();
        
        await ServiceManager.updateUserPointsBalance('user123', 0);
        expect(UserServiceManager.updateUser).not.toHaveBeenCalled();
    });
});


//..................................STANDARD_LOAN_FUNCTIONS.....................................

//.............INITIATE_STD_LOAN
describe("initiateStandardLoanRequest (internal)", () => {
    let borrowerUser, currentUser, loanInput;
    beforeEach(() => {
        borrowerUser = Mocks.createDBUser();
        currentUser = Mocks.createDBUser("admin");
        loanInput = Mocks.createLoanInitiationInput(borrowerUser._id);

        ServiceManager.calculateStandardLoanLimit.mockResolvedValue(1_000_000);
        ServiceManager.calculateStandardLoanRequestMetrics.mockReturnValue({ totalRate: 30, pointsSpent: 0, actualInterest: 150_000, installmentAmount: 54167 });
        ServiceManager.createAndPersistLoan.mockResolvedValue({ _id: 'newloan123' });
    });

    test("should throw error if requested amount exceeds limit", async () => {
        loanInput.amount = 1_500_000; // Exceeds limit
        await expect(ServiceManager.initiateStandardLoanRequest(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate, borrowerUser, currentUser
        )).rejects.toThrow(Errors.AppError);
    });

    test("should call helpers and create loan on success", async () => {
        await ServiceManager.initiateStandardLoanRequest(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate, borrowerUser, currentUser
        );
        expect(ServiceManager.calculateStandardLoanLimit).toHaveBeenCalledWith(borrowerUser.id);
        expect(ServiceManager.calculateStandardLoanRequestMetrics).toHaveBeenCalledWith(loanInput.amount, loanInput.duration, borrowerUser.points);
        expect(ServiceManager.createAndPersistLoan).toHaveBeenCalled();
    });
});

//.....................HELPER_FUNCTIONS_FOR_INITIATING_STANDARD_LOANS...................................
describe("calculateStandardLoanLimit", () => {
    test("should calculate the correct loan limit", async () => {
        const borrowerUser = Mocks.createDBUser("regular");
        borrowerUser.investmentAmount = 1_000_000;
        UserServiceManager.getUserById.mockResolvedValue(borrowerUser);
        Loan.find.mockResolvedValue([{ principalLeft: 100_000 }]);
        ServiceManager.getAggregatedLoanInterestByPeriod.mockResolvedValue(80_000);
        const limit = await ServiceManager.calculateStandardLoanLimit(borrowerUser._id);
        expect(limit).toBe(1_250_000);
    });
});

describe("getAggregatedLoanInterestByPeriod", () => {
    test("should correctly categorize loans and sum their calculated interest", async () => {
        const user = Mocks.createDBUser();
        // Mock getLoans to return a controlled set of loans
        ServiceManager.getLoans.mockResolvedValue([
            { _id: 'loan1', status: 'Ended'}, // Will be Cat 1
            { _id: 'loan2', status: 'Ended'}, // Will be Cat 2
            { _id: 'loan3', status: 'Ongoing'}, // Will be Cat 3
            { _id: 'loan4', status: 'Ongoing'}, // Will be Cat 4
        ]);
        
        // Mock helpers to control categorization and interest calculation
        ServiceManager.getLoanEffectiveEndDate
            .mockResolvedValueOnce({ effectiveLoanEndDate: new Date("2025-02-15") }) // Cat 1
            .mockResolvedValueOnce({ effectiveLoanEndDate: new Date("2025-02-20") }) // Cat 2
            .mockResolvedValueOnce({ effectiveLoanEndDate: new Date("2025-04-10") }) // Cat 3
            .mockResolvedValueOnce({ effectiveLoanEndDate: new Date("2025-04-15") }); // Cat 4
        
        const cat1Spy = ServiceManager.getInterestForLoansStartedAndEndedWithinPeriod.mockResolvedValue(10);
        const cat2Spy = ServiceManager.getProroratedInterestForStartedBeforePeriodEndedBeforePeriod.mockResolvedValue(20);
        const cat3Spy = ServiceManager.getProratedInterestForStartedAfterPeriodEndedAfterPeriod.mockResolvedValue(30);
        const cat4Spy = ServiceManager.getInterestForLoansSpanningPeriod.mockResolvedValue(40);

        const totalInterest = await ServiceManager.getAggregatedLoanInterestByPeriod({
            memberIds: [user._id],
            periodStart: new Date("2025-02-01"),
            periodEnd: new Date("2025-03-31")
        });

        // Check that the right loan went to the right category calculator
        expect(cat1Spy).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({_id: 'loan1'})]));
        expect(cat2Spy).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({_id: 'loan2'})]));
        expect(cat3Spy).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({_id: 'loan3'})]));
        expect(cat4Spy).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({_id: 'loan4'})]));
        
        // Check final sum
        expect(totalInterest).toBe(100); // 10 + 20 + 30 + 40
    });
});

describe("Interest Aggregation Category Helpers", () => {
    test("getInterestForLoansStartedAndEndedWithinPeriod should sum interestAmountPaid", async () => {
        const loans = [{ interestAmountPaid: 100 }, { interestAmountPaid: 200 }];
        const result = await ServiceManager.getInterestForLoansStartedAndEndedWithinPeriod(loans);
        expect(result).toBe(300);
    });

    test("getProroratedInterestForStartedBeforePeriodEndedBeforePeriod should calculate correctly", async () => {
        const loan = { interestAmountPaid: 1000 };
        // total duration = 100 days. days in period = 50. factor = 50/100 = 0.5
        ServiceManager.getLoanEffectiveEndDate.mockResolvedValue({ actualDurationDays: 100 });
        ServiceManager.getDaysDifference.mockReturnValue(50);
        const result = await ServiceManager.getProroratedInterestForStartedBeforePeriodEndedBeforePeriod([loan], new Date(), new Date());
        expect(result).toBe(500); // 1000 * 0.5
    });
    
    test("getProratedInterestForStartedAfterPeriodEndedAfterPeriod should calculate correctly", async () => {
        const loan = { status: 'Ongoing', borrower: { id: 'user1' } };
        // total duration = 200 days. days NOT in period = 50. days in period = 150. factor = 150/200 = 0.75
        ServiceManager.getLoanEffectiveEndDate.mockResolvedValue({ actualDurationDays: 200 });
        ServiceManager.getDaysDifference.mockReturnValue(50); // Mocks daysNewDateExceedsPeriodEnd
        UserServiceManager.getUserById.mockResolvedValue(Mocks.createDBUser());
        ServiceManager.calculateCashInterestDueAmount.mockReturnValue({ totalInterest: 1000 });
        const result = await ServiceManager.getProratedInterestForStartedAfterPeriodEndedAfterPeriod([loan], new Date(), new Date());
        expect(result).toBe(750); // 1000 * 0.75
    });
    
    test("getInterestForLoansSpanningPeriod should calculate correctly", async () => {
        const loan = { status: 'Ongoing', borrower: { id: 'user1' } };
        // total duration = 300. days within period = 60. factor = 60/300 = 0.2
        ServiceManager.getLoanEffectiveEndDate.mockResolvedValue({ actualDurationDays: 300 });
        ServiceManager.getDaysDifference.mockReturnValue(60); // Mocks daysWithinPeriod
        UserServiceManager.getUserById.mockResolvedValue(Mocks.createDBUser());
        ServiceManager.calculateCashInterestDueAmount.mockReturnValue({ totalInterest: 1000 });
        const result = await ServiceManager.getInterestForLoansSpanningPeriod([loan], new Date(), new Date(), new Date());
        expect(result).toBe(200); // 1000 * 0.2
    });
});


describe("Standard Loan Calculation Helpers", () => {
    test("getLimitMultiplier should correctly interpolate", () => {
        expect(ServiceManager.getLimitMultiplier(10_000, 1_000_000)).toBe(1.5); // ratio 0.01 <= 0.05 -> max
        expect(ServiceManager.getLimitMultiplier(250_000, 1_000_000)).toBe(0.75); // ratio 0.25 >= 0.20 -> min
        expect(ServiceManager.getLimitMultiplier(125_000, 1_000_000)).toBe(1.125); // ratio 0.125 -> halfway
    });

    test("calculateStandardLoanRequestMetrics should return correct loan metrics", () => {
        ServiceManager.calculateLoanPointsNeeded.mockReturnValue({ pointsSpent: 1000 });
        Constants.POINTS_VALUE_PER_UNIT = 100; // Use a sensible value for testing
        
        const metrics = ServiceManager.calculateStandardLoanRequestMetrics(100_000, 12, 5000);
        
        expect(ServiceManager.calculateLoanPointsNeeded).toHaveBeenCalledWith(100_000, 12, 5000, 30);
        expect(metrics.totalRate).toBe(30); // 2.5 * 12
        expect(metrics.pointsSpent).toBe(1000);
        // actualInterest = (30 * 100k / 100) - (1000 * 100) = 30000 - 100000 = -70000. Logic is tested as is.
        expect(metrics.actualInterest).toBe(-70000);
        expect(metrics.installmentAmount).toBe(2500); // (100k - 70k) / 12
    });

    test("calculateLoanPointsNeeded should calculate points correctly based on duration", () => {
        // Duration < 1.5 years (18 months)
        let result = ServiceManager.calculateLoanPointsNeeded(100_000, 12, 20_000, 30);
        // pointsNeeded = (30 - 12) * 100k / 100 = 18000. pointsSpent = min(18000, 20000) = 18000
        expect(result.pointsSpent).toBe(18000);

        // Duration >= 1.5 years
        result = ServiceManager.calculateLoanPointsNeeded(100_000, 20, 10_000, 50);
        // pointsNeeded = (12 * 100k/100) + ((20-18)*2.5*100k/100) = 12000 + 5000 = 17000. pointsSpent = min(17000, 10000) = 10000
        expect(result.pointsSpent).toBe(10000);
    });

    test("calculatePointsConsumed should convert interest amount to points", () => {
        Constants.POINTS_VALUE_PER_UNIT = 1000;
        const points = ServiceManager.calculatePointsConsumed(50000);
        expect(points).toBe(50);
    });
});



//....................APPROVE_STD_LOAN

describe("approveStandardLoanRequest (internal)", () => {
    let pendingLoan, approver, sources, borrowerUser;

    beforeEach(async () => {
        borrowerUser = Mocks.createDBUser();
        approver = Mocks.createDBUser("admin");
        pendingLoan = Mocks.createDBLoan(borrowerUser, approver, "Pending Approval");
        pendingLoan.save = jest.fn().mockResolvedValue(pendingLoan);
        sources = [
            { id: new mongoose.Types.ObjectId().toString(), amount: 200_000 },
            { id: new mongoose.Types.ObjectId().toString(), amount: 300_000 }
        ];
        ServiceManager.updateLoanRecord.mockResolvedValue({ matchedCount: 1 });
        await ServiceManager.approveStandardLoanRequest(pendingLoan, approver, sources, borrowerUser);
    });

    test("should deduct funds from all cash location sources", () => {
        expect(CashLocationServiceManager.addToCashLocation).toHaveBeenCalledTimes(2);
        expect(CashLocationServiceManager.addToCashLocation).toHaveBeenCalledWith(sources[0].id, -sources[0].amount);
    });

    test("should call updateLoanRecord with 'Ongoing' status and approval details", () => {
        expect(ServiceManager.updateLoanRecord).toHaveBeenCalledWith(pendingLoan._id, expect.objectContaining({ status: "Ongoing" }));
    });

    test("should send an approval email", () => {
        expect(EmailServiceManager.sendEmailWithTemplate).toHaveBeenCalledWith(expect.objectContaining({
            subject: "Your Loan Request Was Approved!",
            templateName: "loan-approved.ejs",
        }));
    });
});

//............PROCESS_STD_LOAN_PYMT
describe("processStandardLoanPayment (internal)", () => {
    let loan, user, currentUser, paymentDate;
    beforeEach(() => {
        user = Mocks.createDBUser();
        currentUser = Mocks.createDBUser("admin");
        loan = Mocks.createDBLoan(user, currentUser);
        loan.save = jest.fn().mockResolvedValue(loan);
        paymentDate = new Date();

        ServiceManager.calculateCashInterestDueAmount.mockReturnValue({ totalInterestDue: 10000, totalInterest: 10000 });
        ServiceManager.calculatePointsConsumed.mockReturnValue(5);
        ServiceManager.updateLoanAfterPayment.mockReturnValue(45000); // Return pending debt
        ServiceManager.handleExcessPayment.mockResolvedValue();
        ServiceManager.updateUserPointsBalance.mockResolvedValue();
    });

    test("should orchestrate a standard payment correctly", async () => {
        ServiceManager.calculateStandardLoanPrincipalPaid.mockReturnValue({ interestPaid: 10000, principalPaid: 40000, excessAmount: 0 });
        
        await ServiceManager.processStandardLoanPayment(loan, 50000, 'cash_loc_id', currentUser, paymentDate);
        
        expect(ServiceManager.updateUserPointsBalance).toHaveBeenCalledWith(user._id, -5);
        expect(ServiceManager.updateLoanAfterPayment).toHaveBeenCalled();
        expect(loan.payments.length).toBe(1);
        expect(loan.payments[0].amount).toBe(50000);
        expect(CashLocationServiceManager.addToCashLocation).toHaveBeenCalledWith('cash_loc_id', 50000);
        expect(loan.save).toHaveBeenCalled();
        expect(EmailServiceManager.sendEmailWithTemplate).toHaveBeenCalledWith(expect.objectContaining({
            templateName: "loan-payment-confirmation.ejs"
        }));
    });

    test("should handle excess payment and use 'loan-cleared' template", async () => {
        ServiceManager.calculateStandardLoanPrincipalPaid.mockReturnValue({ interestPaid: 10000, principalPaid: 490000, excessAmount: 2000 });
        ServiceManager.updateLoanAfterPayment.mockReturnValue(0); // No pending debt

        await ServiceManager.processStandardLoanPayment(loan, 502000, 'cash_loc_id', currentUser, paymentDate);
        
        expect(ServiceManager.handleExcessPayment).toHaveBeenCalledWith(2000, user, 'cash_loc_id', currentUser, paymentDate);
        expect(EmailServiceManager.sendEmailWithTemplate).toHaveBeenCalledWith(expect.objectContaining({
            templateName: "loan-cleared.ejs"
        }));
    });
});


//.....................HELPER_FUNCTIONS_FOR_STANDARD_LOAN_PAYMENTS...................................
describe("calculateStandardLoanPrincipalPaid", () => {
    test("should distribute payment correctly when payment clears all debt and has excess", () => {
        const result = ServiceManager.calculateStandardLoanPrincipalPaid(120_000, 10_000, 100_000);
        expect(result).toEqual({ interestPaid: 10_000, principalPaid: 100_000, excessAmount: 10_000 });
    });
});

describe("Shared Date & Interest Calculation Helpers", () => {
    test("calculateTotalInterestDueAmount should calculate compound interest", () => {
        Constants.MONTHLY_LENDING_RATE = 10; // Use 10% for simple math
        const interest = ServiceManager.calculateTotalInterestDueAmount(100_000, new Date("2025-01-01"), new Date("2025-02-01"));
        // 1 month due. totalAmount = 100k * (1.1)^1 = 110k. interest = 110k - 100k = 10k.
        expect(interest).toBe(10_000);
    });

    test("calculatePointsInterestDueAmount should calculate the correct portion of interest clearable by points", () => {
        ServiceManager.calculateTotalInterestDueAmount.mockReturnValue(10_000);
        ServiceManager.calculateTotalMonthsDue.mockReturnValue(4);
        ServiceManager.calculatePointsMonthsDue.mockReturnValue(1); // 1 of 4 months is point-eligible
        
        const loan = Mocks.createDBLoan(Mocks.createDBUser(), Mocks.createDBUser());
        loan.save = jest.fn().mockResolvedValue(loan);
        const result = ServiceManager.calculatePointsInterestDueAmount(loan, 50000, new Date());
        // pointsInterestDue = 10000 * (1/4) = 2500. Limited by available points (50k * 1000 = 50M).
        expect(result).toBe(2500);
    });

    test("getLoanEffectiveEndDate should calculate the correct end date from units", () => {
        const loan = {
            date: new Date("2025-01-01"),
            amount: 10_000,
            units: 300_000, // 300k / 10k = 30 days duration
            status: "Ended"
        };
        const { effectiveLoanEndDate } = ServiceManager.getLoanEffectiveEndDate(loan);
        expect(effectiveLoanEndDate.toISOString().split('T')[0]).toBe("2025-01-31");
    });
});

describe("Remaining Calculation Helpers", () => {
    test("calculateCashInterestDueAmount should subtract point-eligible interest", () => {
        ServiceManager.calculateTotalInterestDueAmount.mockReturnValue(20000);
        ServiceManager.calculatePointsInterestDueAmount.mockReturnValue(5000);
        const { totalInterestDue } = ServiceManager.calculateCashInterestDueAmount({}, new Date(), 10000);
        expect(totalInterestDue).toBe(15000); // 20000 - 5000
    });

    test("calculatePointMonthsAccrued should calculate point-eligible months correctly", () => {
        Constants.ONE_YEAR_MONTH_THRESHOLD = 10;
        Constants.ONE_YEAR_MONTHS = 12;

        // Scenario 1: Duration is below the threshold (e.g., 9 months)
        ServiceManager.getDaysDifference.mockReturnValue(9 * 30);
        expect(ServiceManager.calculatePointMonthsAccrued(new Date(), new Date())).toBe(0);
        
        // Scenario 2: Duration is within the first year's point window (e.g., 11 months)
        // Expected: 11 - 10 = 1 month
        ServiceManager.getDaysDifference.mockReturnValue(11 * 30);
        expect(ServiceManager.calculatePointMonthsAccrued(new Date(), new Date())).toBe(1);

        // Scenario 3: Duration is over 1 year, but remainder is not in point window (e.g., 15 months)
        // Expected: 2 (from the first full year) + 0 (from the remaining 3 months) = 2 months
        ServiceManager.getDaysDifference.mockReturnValue(15 * 30);
        expect(ServiceManager.calculatePointMonthsAccrued(new Date(), new Date())).toBe(2);
        
        // Scenario 4: Duration is over 1 year, and remainder is exactly at the threshold (e.g., 22 months)
        // Expected: 2 (from the first full year) + 0 (from the remaining 10 months) = 2 months
        ServiceManager.getDaysDifference.mockReturnValue(22 * 30);
        expect(ServiceManager.calculatePointMonthsAccrued(new Date(), new Date())).toBe(2);

        // Scenario 5: Duration is over 1 year, and remainder is in the point window (e.g., 23 months)
        // Expected: 2 (from first year) + 1 (from remaining 11 months) = 3 months
        ServiceManager.getDaysDifference.mockReturnValue(23 * 30);
        expect(ServiceManager.calculatePointMonthsAccrued(new Date(), new Date())).toBe(3);
    });

    test("calculatePointsMonthsDue should return the difference of accrued months", () => {
        const spy = ServiceManager.calculatePointMonthsAccrued;
        spy.mockReturnValueOnce(15); // Total accrued up to current date
        spy.mockReturnValueOnce(10); // Accrued up to last payment date
        const result = ServiceManager.calculatePointsMonthsDue(new Date(), new Date(), new Date());
        expect(result).toBe(5); // 15 - 10
    });
});

describe("updateLoanAfterPayment", () => {
    test("should update loan state to 'Ended' after a final payment", () => {
        const loan = Mocks.createDBLoan(Mocks.createDBUser(), Mocks.createDBUser());
        loan.save = jest.fn().mockResolvedValue(loan);
        loan.principalLeft = 40_000;
        loan.interestAmount = -10_000;
        const distribution = { interestPaid: 10_000, principalPaid: 40_000 };
        const paymentDate = new Date("2025-09-10T00:00:00.000Z");
        ServiceManager.updateLoanAfterPayment(loan, distribution, 500, paymentDate);
        expect(loan.principalLeft).toBe(0);
        expect(loan.status).toBe("Ended");
    });
});

describe("handleExcessPayment (internal)", () => {
    let user, currentUser;
    beforeEach(() => {
        user = Mocks.createDBUser();
        currentUser = Mocks.createDBUser('admin');
        Constants.MIN_EXCESS_DEPOSIT_THRESHOLD = 1000;
    });

    test("should call DepositService to create a deposit if excess is above threshold", async () => {
        await ServiceManager.handleExcessPayment(1500, user, 'cash_loc_id', currentUser, new Date());
        expect(DepositServiceManager.createDeposit).toHaveBeenCalledWith(expect.objectContaining({
            amount: 1500
        }));
    });

    test("should NOT create a deposit if excess is below threshold", async () => {
        await ServiceManager.handleExcessPayment(500, user, 'cash_loc_id', currentUser, new Date());
        expect(DepositServiceManager.createDeposit).not.toHaveBeenCalled();
    });
});


/**----------------------------------------TEMPORARY_LOANS---------------------------------------------------------------*/
describe("initiateFreeLoanRequest (internal)", () => {
    let borrowerUser, currentUser, loanInput;
    beforeEach(() => {
        borrowerUser = Mocks.createDBUser();
        currentUser = Mocks.createDBUser("admin");
        loanInput = Mocks.createLoanInitiationInput(borrowerUser._id);

        ServiceManager.calculateFreeLoanEligibility.mockReturnValue({ loanLimit: 500_000, loanPeriodLimit: 300 });
        ServiceManager.createAndPersistLoan.mockResolvedValue({ _id: 'newloan789' });
    });

    test("should throw error if duration exceeds period limit", async () => {
        loanInput.duration = 350; // Exceeds limit
        await expect(ServiceManager.initiateFreeLoanRequest(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate, borrowerUser, currentUser
        )).rejects.toThrow(Errors.AppError);
    });

    test("should call helpers and create an Interest-Free loan on success", async () => {
        await ServiceManager.initiateFreeLoanRequest(
            loanInput.amount, loanInput.duration, loanInput.earliestDate, loanInput.latestDate, borrowerUser, currentUser
        );
        expect(ServiceManager.calculateFreeLoanEligibility).toHaveBeenCalledWith(borrowerUser, loanInput.amount, loanInput.duration);
        expect(ServiceManager.createAndPersistLoan).toHaveBeenCalledWith(expect.objectContaining({
            type: "Interest-Free",
            rate: 0
        }));
    });
});


describe("calculateFreeLoanEligibility", () => {
    test("should correctly calculate the loan limit and period limit", () => {
        const user = Mocks.createDBUser("regular");
        const { loanLimit, loanPeriodLimit } = ServiceManager.calculateFreeLoanEligibility(user, 500_000, 12);
        // Using current date from prompt context: July 17, 2025. Mock date is May 1, 2025. Diff = 77 days.
        // Total Units = (1M * 77) + 50M = 127M
        // Period Limit = 127M / 500k = 254
        expect(loanPeriodLimit).toBe(254);
        // Loan Limit = 127M / 12 = 10,583,333
        expect(loanLimit).toBe(10583333);
    });
});

describe("approveFreeLoanRequest (internal)", () => {
    let freeLoan, approver, sources, borrowerUser;

    beforeEach(async () => {
        borrowerUser = Mocks.createDBUser();
        approver = Mocks.createDBUser("admin");
        freeLoan = Mocks.createDBLoan(borrowerUser, approver, "Pending Approval", "Interest-Free");
        freeLoan.save = jest.fn().mockResolvedValue(freeLoan);
        freeLoan.units = 6_000_000;
        sources = [{ id: new mongoose.Types.ObjectId().toString(), amount: 500_000 }];
        ServiceManager.updateLoanRecord.mockResolvedValue({ matchedCount: 1 });
        await ServiceManager.approveFreeLoanRequest(freeLoan, approver, sources, borrowerUser);
    });

    test("should deduct from the user's temporary investment units", () => {
        expect(UserServiceManager.addTemporaryInvestmentUnits).toHaveBeenCalledWith(borrowerUser._id, -freeLoan.units);
    });

    test("should call updateLoanRecord and reset loan units to 0", () => {
        expect(ServiceManager.updateLoanRecord).toHaveBeenCalledWith(freeLoan._id, expect.objectContaining({
            status: "Ongoing",
            units: 0,
        }));
    });
});

describe("calculateFreeLoanPrincipleLeft (internal dispatcher)", () => {
    let user, loan, paymentDate;
    beforeEach(() => {
        user = Mocks.createDBUser();
        loan = Mocks.createDBLoan(user, Mocks.createDBUser(), "Ongoing", "Interest-Free");
        paymentDate = new Date();

        // Use spyOn to mock the internal handler functions
        jest.spyOn(ServiceManager, 'handlePartialPrincipalPayment').mockImplementation(() => {});
        jest.spyOn(ServiceManager, 'handleExcessUnitsNoCashInterest').mockImplementation(() => {});
        jest.spyOn(ServiceManager, 'handleCashInterestPayment').mockImplementation(() => {});
    });

    test("should call handlePartialPrincipalPayment for partial payments", async () => {
        ServiceManager.calculateFreeLoanOverdueMetrics.mockResolvedValue({ excessUnits: 0, cashInterest: 0 });
        await ServiceManager.calculateFreeLoanPrincipleLeft(user, loan, 100_000, paymentDate);
        expect(ServiceManager.handlePartialPrincipalPayment).toHaveBeenCalledWith(loan, 100_000);
    });

    test("should call handleCashInterestPayment when cash interest has accrued", async () => {
        ServiceManager.calculateFreeLoanOverdueMetrics.mockResolvedValue({ excessUnits: 150_000, cashInterest: 5000 });
        await ServiceManager.calculateFreeLoanPrincipleLeft(user, loan, 505_000, paymentDate);
        expect(ServiceManager.handleCashInterestPayment).toHaveBeenCalled();
    });
});



describe("calculateFreeLoanOverdueMetrics (internal)", () => {
    let user, loan, paymentDate;
    beforeEach(() => {
        user = Mocks.createDBUser();
        loan = Mocks.createDBLoan(user, Mocks.createDBUser(), "Ongoing", "Interest-Free");
        loan.save = jest.fn().mockResolvedValue(loan);
        paymentDate = new Date("2025-08-01");
        loan.lastPaymentDate = new Date("2025-07-01"); // 31 days difference
        loan.principalLeft = 100_000;
        loan.units = 0;
        loan.amount = 500_000;
        loan.duration = 1; // 1 month loan duration
    });
    
    test("should return zero cash interest if excess units are covered by savings", async () => {
        // currentLoanUnits = 31 * 100k = 3.1M
        // loan value = 500k * 1 = 500k
        // excessUnits = 3.1M - 500k = 2.6M
        // temp savings units = (1M * 92 days) + 50M = 142M (user's savings can cover excess)
        const metrics = await ServiceManager.calculateFreeLoanOverdueMetrics(loan, user, paymentDate);
        expect(metrics.cashInterest).toBe(0);
        expect(metrics.excessUnits).toBeGreaterThan(0);
    });

    test("should return positive cash interest if excess units are not covered by savings", async () => {
        user.temporaryInvestment.units = 0; // User has very little savings units
        user.temporaryInvestment.amount = 10_000;
        // temp savings units = (10k * 92) = 920k (cannot cover 2.6M excess)
        const metrics = await ServiceManager.calculateFreeLoanOverdueMetrics(loan, user, paymentDate);
        expect(metrics.cashInterest).toBeGreaterThan(0);
    });
});

describe("Free Loan Payment Handlers", () => {
    let user, loan;
    beforeEach(() => {
        user = Mocks.createDBUser();
        loan = Mocks.createDBLoan(user, Mocks.createDBUser(), "Ongoing", "Interest-Free");
        loan.save = jest.fn().mockResolvedValue(loan);
    });
    
    test("handlePartialPrincipalPayment should correctly reduce principalLeft", () => {
        loan.principalLeft = 100_000;
        ServiceManager.handlePartialPrincipalPayment(loan, 40_000);
        expect(loan.principalLeft).toBe(60_000);
    });
    
    test("handleExcessUnitsNoCashInterest should clear loan and update user units", async () => {
        await ServiceManager.handleExcessUnitsNoCashInterest(user, loan, 100_000, 40_000, new Date());
        // additionalUnits = 100k - 40k = 60k
        expect(UserServiceManager.addTemporaryInvestmentUnits).toHaveBeenCalledWith(user._id, 60_000);
        expect(UserServiceManager.setTemporaryInvestmentUnitsDate).toHaveBeenCalled();
        expect(loan.status).toBe("Ended");
        expect(loan.principalLeft).toBe(0);
    });
    
    test("handleCashInterestPayment should clear loan if payment is sufficient", async () => {
        loan.principalLeft = 100_000;
        await ServiceManager.handleCashInterestPayment(user, loan, 105_000, 5_000, new Date());
        expect(UserServiceManager.addTemporaryInvestmentUnits).toHaveBeenCalledWith(user._id, -user.temporaryInvestment.units);
        expect(loan.status).toBe("Ended");
        expect(loan.principalLeft).toBe(0);
        expect(loan.interestAmount).toBe(5_000);
    });
});


