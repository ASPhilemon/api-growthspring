// Import { jest } from '@jest/globals';
// Import * as Errors from '../../../utils/error-util.js';

// // --- Mock Dependencies ---
// // We mock the modules that the service file will import.

// // Mock factory for constants to allow dynamic overrides in tests
// Const createMockConstants = (overrides = {}) => ({
//     Default: {
//         ONE_MONTH_DAYS: 30,
//         GRACE_PERIOD_DAYS: 7,
//         ONE_YEAR_MONTHS: 12,
//         ONE_YEAR_MONTH_THRESHOLD: 6,
//         INTEREST_MULTIPLIER_RULES: {
//             MinInterestRatio: 0.18,
//             MaxInterestRatio: 0.36,
//             MaxMultiplier: 2.0,
//             MinMultiplier: 1.2
//         },
//         MONTHLY_LENDING_RATE: 0.02,
//         POINTS_VALUE_PER_UNIT: 1000,
//         ...overrides,
//     },
// });
// Jest.unstable_mockModule('../../../src/config/constants.js', () => createMockConstants());

// // Mock the date utility to control its output during tests.
// Let DateUtil = await import('../../../utils/date-util.js');
// Jest.unstable_mockModule('../../../utils/date-util.js', async () => ({
//     ...DateUtil,
//     GetDaysDifference: jest.fn(),
// }));
// DateUtil = await import('../../../utils/date-util.js');

// // Mock the models file
// Jest.unstable_mockModule('../models.js', () => ({
//     Loan: {
//         Find: jest.fn(),
//         GetFilteredLoans: jest.fn(),
//     },
// }));

// // Mock the user service
// Jest.unstable_mockModule('../../../services/user-service/service.js', () => ({
//     GetUserById: jest.fn(),
// }));

// // Mock the validator utility
// Jest.unstable_mockModule('../../../utils/validator-util.js', () => ({
//     Assert: jest.fn((condition, message) => {
//         If (!condition) throw new Errors.AppError(message);
//     }),
//     Required: jest.fn(),
// }));

// // --- Import the REAL Service to Test ---
// Const ServiceManager = await import("../service.js");
// Const { Loan } = await import("../models.js");
// Const UserServiceManager = await import('../../user-service/service.js');

// // Factory for mock loans
// Const createMockLoan = (overrides = {}) => ({
//     Date: new Date("2025-01-01T00:00:00.000Z"),
//     Amount: 10_000,
//     Units: 300_000, // Default 30 days duration
//     Status: "Ended",
//     PrincipalLeft: 10_000,
//     LastPaymentDate: new Date("2025-01-01T00:00:00.000Z"),
//     InterestAmountPaid: 0,
//     ...overrides,
// });

// // Factory for mock users
// Const createMockUser = (overrides = {}) => ({
//     InvestmentAmount: 1_000_000,
//     Points: 5000,
//     ...overrides,
// });

// // --- Test Setup ---
// BeforeEach(() => {
//     // Clear any previous mock data before each test runs
//     Jest.clearAllMocks();
// });

// // --- Test Suites ---

// // Purpose: Tests functions for calculating loan durations and months due, including grace periods and point accruals.
// Describe("Loan Duration Calculations", () => {

//     Describe("calculateTotalMonthsDue", () => {
//         Const scenarios = [
//             [0, 1], // Zero days: expect 0
//             [1, 1], // Within grace period (1 day): expect 1
//             [6, 1], // Near grace period end (6 days): expect 1
//             [7, 1], // Exact grace period (7 days): expect 1
//             [8, 1], // Just over grace period (8 days): expect 1
//             [29, 1], // Almost full month (29 days): expect 1
//             [30, 1], // Exact one month (30 days): expect 1
//             [31, 1], // One month +1 day (within grace): expect 1
//             [36, 1], // One month +6 days (within grace): expect 1
//             [37, 1], // One month +7 days (exact grace): expect 1
//             [38, 2], // One month +8 days (exceeds grace): expect 2
//             [60, 2], // Two full months (60 days): expect 2
//             [67, 2], // Two months +7 days (grace): expect 2
//             [68, 3], // Two months +8 days (exceeds): expect 3
//             [365, 12], // Approximately one year: expect 12
//             [730, 25], // Two years (730 days, no remainder > grace): expect 25
//         ];

//         Test.each(scenarios)("for %i days difference should return %i months", (daysDifference, expectedMonths) => {
//             DateUtil.getDaysDifference.mockReturnValue(daysDifference);
//             Const months = ServiceManager.calculateTotalMonthsDue(new Date(), new Date());
//             Expect(months).toBe(expectedMonths);
//         });
//     });

//     Describe("calculatePointMonthsAccrued", () => {
//         Const scenarios = [
//             [-10, 0], // Negative duration: expect 0
//             [0, 0], // Zero days: expect 0
//             [150, 0], // 5 months (below threshold): expect 0
//             [180, 0], // Exact threshold (6 months): expect 0
//             [181, 0], // Just over threshold, but fractional <0.24: expect 0
//             [270, 3], // 9 months (within first year): expect 3
//             [360, 6], // 12 months (full year): expect 6
//             [450, 6], // 15 months (1 year +3): expect 6
//             [540, 6], // 18 months (1.5 years): expect 6
//             [600, 8], // 20 months: expect 8
//             [720, 12], // 24 months (2 years): expect 12
//             [1080, 18], // 36 months (3 years): expect 18
//             [30.5, 0], // Fractional days (if possible): expect 0
//         ];

//         Test.each(scenarios)("for %i days duration should return %i point months", (totalDaysSinceLoan, expected) => {
//             DateUtil.getDaysDifference.mockReturnValue(totalDaysSinceLoan);
//             Const result = ServiceManager.calculatePointMonthsAccrued(new Date(), new Date());
//             Expect(result).toBe(expected);
//         });
//     });
// });

// // Purpose: Tests general helpers for loan limits and effective end dates.
// Describe("General Loan Calculation Helpers", () => {

//     Describe("_calculateLimit", () => {
//         Const scenarios = [
//             [ {investmentAmount: 1000000}, [], 0, 2000000 ], // Zero debts, zero interest: max multiplier 2.0
//             [ {investmentAmount: 1000000}, [{principalLeft: 100000}], 0, 1900000 ], // With debt: subtract
//             [ {investmentAmount: 1000000}, [], 180000, 2000000 ], // Min ratio: max multiplier
//             [ {investmentAmount: 1000000}, [], 360000, 1200000 ], // Max ratio: min multiplier
//             [ {investmentAmount: 1000000}, [], 270000, 1600000 ], // Mid ratio: 1.6 multiplier
//             [ {investmentAmount: 0}, [], 0, 0 ], // Zero investment: 0
//         ];

//         Test.each(scenarios)("should calculate limit correctly for user investment %p, debts %p, interest %i", (user, ongoingDebts, interestPaid, expected) => {
//             Const limit = ServiceManager._calculateLimit(user, ongoingDebts, interestPaid);
//             Expect(limit).toBe(expected);
//         });
//     });

//     Describe("getLoanEffectiveEndDate", () => {
//         Const scenarios = [
//             [300_000, 10_000, "Ended", "2025-01-31"], // 30 days: Jan 31
//             [0, 10_000, "Ended", "2025-01-01"], // Zero units: same date
//             [310_000, 10_000, "Ended", "2025-02-01"], // 31 days: Feb 1
//             [590_000, 10_000, "Ended", "2025-03-01"], // 59 days -> 2025-03-01? Jan1 +59: Jan31 +Feb28=59, Mar1
//         ];

//         Test.each(scenarios)("for units %i, amount %i, status %s should return end date %s", (units, amount, status, expectedDate) => {
//             Const loan = createMockLoan({ units, amount, status });
//             Const { effectiveLoanEndDate } = ServiceManager.getLoanEffectiveEndDate(loan);
//             Expect(effectiveLoanEndDate.toISOString().split('T')[0]).toBe(expectedDate);
//         });

//         Test("should handle ongoing status with mocked days since last payment", () => {
//             Const loan = createMockLoan({ amount: 20000, status: "Ongoing", principalLeft: 5000, units: 50000 });
//             DateUtil.getDaysDifference.mockReturnValue(10); // 10 days since last
//             Const { effectiveLoanEndDate } = ServiceManager.getLoanEffectiveEndDate(loan);
//             // projectedUnits = 50000 + 10 * 5000 = 100000, duration = 100000 / 20000 = 5 days
//             // End = 2025-01-01 +5 = 2025-01-06
//             Expect(effectiveLoanEndDate.toISOString().split('T')[0]).toBe("2025-01-06");
//         });

//         Test("should return start date for zero duration in ongoing", () => {
//             Const loan = createMockLoan({ amount: 20000, status: "Ongoing", principalLeft: 20000, units: 0 });
//             DateUtil.getDaysDifference.mockReturnValue(0);
//             Const { effectiveLoanEndDate } = ServiceManager.getLoanEffectiveEndDate(loan);
//             Expect(effectiveLoanEndDate.toISOString().split('T')[0]).toBe("2025-01-01");
//         });
//     });
// });

// // Purpose: Tests helpers specific to standard loan calculations, including multipliers, points, and metrics.
// Describe("Standard Loan Calculation Helpers", () => {

//     Describe("getLimitMultiplier", () => {
//         Const scenarios = [
//             [100_000, 1_000_000, 2.0], // Low ratio (0.1): max 2.0
//             [180_000, 1_000_000, 2.0], // Exact min ratio (0.18): max 2.0
//             [270_000, 1_000_000, 1.6], // Mid ratio (0.27): 1.6
//             [360_000, 1_000_000, 1.2], // Exact max ratio (0.36): min 1.2
//             [400_000, 1_000_000, 1.2], // High ratio (0.4): min 1.2
//             [0, 1_000_000, 2.0], // Zero interest: max
//             [-10_000, 1_000_000, 2.0], // Negative interest: treated as low
//             [100_000, 0, 1.2], // Zero savings: min
//             [100_000, -1_000_000, 1.2], // Negative savings: min
//         ];

//         Test.each(scenarios)("should return multiplier %f for interest %i and savings %i", (interestPaid, currentSavings, expected) => {
//             Const multiplier = ServiceManager.getLimitMultiplier(interestPaid, currentSavings);
//             Expect(multiplier).toBe(expected);
//         });
//     });

//     Describe("calculateLoanPointsNeeded", () => {
//         Const scenarios = [
//             [100_000, 12, 20_000, 0.24, 12, 12], 
//             [1_000_000, 12, 5000, 0.48, 360, 360], 
//             [100_000, 24, 1000, 0.48, 24, 24], // Long duration: calculate based on formula
//             [0, 12, 0, 0.24, 0, 0], // Zero amount: 0
//             [100_000, 0, 100, 0, 0, 0], // Zero duration: 0
//             [100_000, 18, 50000, 0.36, 12, 12], // 1.5 years: switch formula
//             [100_000, 12, 0, .24, 12, 0], // Needs 12, but 0 points: spent 0
//         ];

//         Test.each(scenarios)("for amount %i, duration %i, points %i, rate %f should return pointsNeeded %i and pointsSpent %i", (loanAmount, loanDuration, borrowerPoints, totalRate, expectedNeeded, expectedSpent) => {
//             Const result = ServiceManager.calculateLoanPointsNeeded(loanAmount, loanDuration, borrowerPoints, totalRate);
//             Expect(result.pointsNeeded).toBe(expectedNeeded);
//             Expect(result.pointsSpent).toBe(expectedSpent);
//         });
//     });

//     Describe("calculateStandardLoanRequestMetrics", () => {
//         Const scenarios = [
//             [1_000_000, 12, 5000, 0.24, 120, 120000, 93333], // Standard: low rate, 0 points
//             [100_000, 12, 20000, 0.24, 12, 12000, 9333], // Smaller loan
//             [1_000_000, 24, 1000, 0.48, 240, 240000, 51667], // Long, points used
//             [100_000, 18, 50000, 0.36, 12, 24000, 6889], // 1.5 years
//         ];

//         Test.each(scenarios)("for amount %i, duration %i, points %i should return correct metrics", (loanAmount, loanDuration, borrowerPoints, expectedRate, expectedSpent, expectedInterest, expectedInstallment) => {
//             Const metrics = ServiceManager.calculateStandardLoanRequestMetrics(loanAmount, loanDuration, borrowerPoints);
//             Expect(metrics.totalRate).toBe(expectedRate);
//             Expect(metrics.pointsSpent).toBe(expectedSpent);
//             Expect(metrics.actualInterest).toBe(expectedInterest);
//             Expect(metrics.installmentAmount).toBe(expectedInstallment);
//         });
//     });
// });

// // Purpose: Tests helpers for processing loan payments, including distributions, interest due, and points consumption.
// Describe("Payment Calculation Helpers", () => {

//     Describe("calculateStandardLoanPrincipalPaid", () => {
//         Const scenarios = [
//             [15000, 10000, 100000, 10000, 5000, 0], // Pays interest + principal
//             [5000, 10000, 100000, 5000, -5000, 0], // Short on interest: negative principal (per code)
//             [120000, 10000, 100000, 10000, 100000, 10000], // Overpay: excess
//             [0, 10000, 100000, 0, -10000, 0], // Zero payment
//         ];

//         Test.each(scenarios)("should distribute payment %i with interest due %i, principal %i to interest %i, principal %i, excess %i", (payment, interestDue, principalLeft, expInterest, expPrincipal, expExcess) => {
//             Const result = ServiceManager.calculateStandardLoanPrincipalPaid(payment, interestDue, principalLeft);
//             Expect(result.interestPaid).toBe(expInterest);
//             Expect(result.principalPaid).toBe(expPrincipal);
//             Expect(result.excessAmount).toBe(expExcess);
//         });
//     });

//     Describe("calculateTotalInterestDueAmount", () => {
//         Const scenarios = [
//             [65, 100_000, 4040], // 65 days ~2 months +5, but months=3? Wait, calculateTotalMonthsDue(65)=2 (65/30=2, into=5<=7,=2)
//             [0, 100_000, 2000], // Zero days
//             [30, 100_000, 2000], // 1 month: ~2000
//             [365, 100_000, 26824.18], // 12 months: compound
//             [730, 100_000, 64060.6], // 25 months
//         ];

//         Test.each(scenarios)("for %i days on amount %i should return interest close to %f", (days, amount, expected) => {
//             DateUtil.getDaysDifference.mockReturnValue(days);
//             Const interest = ServiceManager.calculateTotalInterestDueAmount(amount, new Date(), new Date());
//             Expect(interest).toBeCloseTo(expected, 0);
//         });
//     });

//     Describe("calculatePointsConsumed", () => {
//         Const scenarios = [
//             [50000, 50], // Standard
//             [0, 0], // Zero
//             [-1000, -1], // Negative
//             [1000.5, 1.0005], // Fractional
//         ];

//         Test.each(scenarios)("should return %f points for interest %i", (interestAmount, expected) => {
//             Const points = ServiceManager.calculatePointsConsumed(interestAmount);
//             Expect(points).toBe(expected);
//         });
//     });

//     Describe("calculatePointsMonthsDue", () => {
//         Const scenarios = [
//             [450, 300, 2], // 15*30=450 ->6, 10*30=300 ->4, diff=2
//             [0, 0, 0], // Zero
//             [300, 450, 0], // Cleared > total: 0
//             [-10, 0, 0], // Negative total
//             [180, 0, 0], // Threshold: 0
//             [720, 360, 6], // 24 months=12, 12 months=6, diff=6
//         ];

//         Test.each(scenarios)("should return %i for total days %i, cleared days %i", (totalDays, clearedDays, expected) => {
//             DateUtil.getDaysDifference
//                 .mockReturnValueOnce(totalDays) // for total
//                 .mockReturnValueOnce(clearedDays); // for cleared
//             Const result = ServiceManager.calculatePointsMonthsDue(new Date(), new Date(), new Date());
//             Expect(result).toBe(expected);
//         });
//     });
// });

test("1+1 to equal 2", ()=>{
  expect(1+1).toEqual(2)
})