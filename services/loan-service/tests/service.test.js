// import { jest } from '@jest/globals';
// import * as Errors from '../../../utils/error-util.js';

// // --- Mock Dependencies ---
// // We mock the modules that the service file will import.

// // Mock factory for constants to allow dynamic overrides in tests
// const createMockConstants = (overrides = {}) => ({
//     default: {
//         ONE_MONTH_DAYS: 30,
//         GRACE_PERIOD_DAYS: 7,
//         ONE_YEAR_MONTHS: 12,
//         ONE_YEAR_MONTH_THRESHOLD: 6,
//         INTEREST_MULTIPLIER_RULES: {
//             minInterestRatio: 0.18,
//             maxInterestRatio: 0.36,
//             maxMultiplier: 2.0,
//             minMultiplier: 1.2
//         },
//         MONTHLY_LENDING_RATE: 0.02,
//         POINTS_VALUE_PER_UNIT: 1000,
//         ...overrides,
//     },
// });
// jest.unstable_mockModule('../../../src/config/constants.js', () => createMockConstants());

// // Mock the date utility to control its output during tests.
// let DateUtil = await import('../../../utils/date-util.js');
// jest.unstable_mockModule('../../../utils/date-util.js', async () => ({
//     ...DateUtil,
//     getDaysDifference: jest.fn(),
// }));
// DateUtil = await import('../../../utils/date-util.js');

// // Mock the models file
// jest.unstable_mockModule('../models.js', () => ({
//     Loan: {
//         find: jest.fn(),
//         getFilteredLoans: jest.fn(),
//     },
// }));

// // Mock the user service
// jest.unstable_mockModule('../../../services/user-service/service.js', () => ({
//     getUserById: jest.fn(),
// }));

// // Mock the validator utility
// jest.unstable_mockModule('../../../utils/validator-util.js', () => ({
//     assert: jest.fn((condition, message) => {
//         if (!condition) throw new Errors.AppError(message);
//     }),
//     required: jest.fn(),
// }));

// // --- Import the REAL Service to Test ---
// const ServiceManager = await import("../service.js");
// const { Loan } = await import("../models.js");
// const UserServiceManager = await import('../../user-service/service.js');

// // Factory for mock loans
// const createMockLoan = (overrides = {}) => ({
//     date: new Date("2025-01-01T00:00:00.000Z"),
//     amount: 10_000,
//     units: 300_000, // Default 30 days duration
//     status: "Ended",
//     principalLeft: 10_000,
//     lastPaymentDate: new Date("2025-01-01T00:00:00.000Z"),
//     interestAmountPaid: 0,
//     ...overrides,
// });

// // Factory for mock users
// const createMockUser = (overrides = {}) => ({
//     investmentAmount: 1_000_000,
//     points: 5000,
//     ...overrides,
// });

// // --- Test Setup ---
// beforeEach(() => {
//     // Clear any previous mock data before each test runs
//     jest.clearAllMocks();
// });

// // --- Test Suites ---

// // Purpose: Tests functions for calculating loan durations and months due, including grace periods and point accruals.
// describe("Loan Duration Calculations", () => {

//     describe("calculateTotalMonthsDue", () => {
//         const scenarios = [
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

//         test.each(scenarios)("for %i days difference should return %i months", (daysDifference, expectedMonths) => {
//             DateUtil.getDaysDifference.mockReturnValue(daysDifference);
//             const months = ServiceManager.calculateTotalMonthsDue(new Date(), new Date());
//             expect(months).toBe(expectedMonths);
//         });
//     });

//     describe("calculatePointMonthsAccrued", () => {
//         const scenarios = [
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

//         test.each(scenarios)("for %i days duration should return %i point months", (totalDaysSinceLoan, expected) => {
//             DateUtil.getDaysDifference.mockReturnValue(totalDaysSinceLoan);
//             const result = ServiceManager.calculatePointMonthsAccrued(new Date(), new Date());
//             expect(result).toBe(expected);
//         });
//     });
// });

// // Purpose: Tests general helpers for loan limits and effective end dates.
// describe("General Loan Calculation Helpers", () => {

//     describe("_calculateLimit", () => {
//         const scenarios = [
//             [ {investmentAmount: 1000000}, [], 0, 2000000 ], // Zero debts, zero interest: max multiplier 2.0
//             [ {investmentAmount: 1000000}, [{principalLeft: 100000}], 0, 1900000 ], // With debt: subtract
//             [ {investmentAmount: 1000000}, [], 180000, 2000000 ], // Min ratio: max multiplier
//             [ {investmentAmount: 1000000}, [], 360000, 1200000 ], // Max ratio: min multiplier
//             [ {investmentAmount: 1000000}, [], 270000, 1600000 ], // Mid ratio: 1.6 multiplier
//             [ {investmentAmount: 0}, [], 0, 0 ], // Zero investment: 0
//         ];

//         test.each(scenarios)("should calculate limit correctly for user investment %p, debts %p, interest %i", (user, ongoingDebts, interestPaid, expected) => {
//             const limit = ServiceManager._calculateLimit(user, ongoingDebts, interestPaid);
//             expect(limit).toBe(expected);
//         });
//     });

//     describe("getLoanEffectiveEndDate", () => {
//         const scenarios = [
//             [300_000, 10_000, "Ended", "2025-01-31"], // 30 days: Jan 31
//             [0, 10_000, "Ended", "2025-01-01"], // Zero units: same date
//             [310_000, 10_000, "Ended", "2025-02-01"], // 31 days: Feb 1
//             [590_000, 10_000, "Ended", "2025-03-01"], // 59 days -> 2025-03-01? Jan1 +59: Jan31 +Feb28=59, Mar1
//         ];

//         test.each(scenarios)("for units %i, amount %i, status %s should return end date %s", (units, amount, status, expectedDate) => {
//             const loan = createMockLoan({ units, amount, status });
//             const { effectiveLoanEndDate } = ServiceManager.getLoanEffectiveEndDate(loan);
//             expect(effectiveLoanEndDate.toISOString().split('T')[0]).toBe(expectedDate);
//         });

//         test("should handle ongoing status with mocked days since last payment", () => {
//             const loan = createMockLoan({ amount: 20000, status: "Ongoing", principalLeft: 5000, units: 50000 });
//             DateUtil.getDaysDifference.mockReturnValue(10); // 10 days since last
//             const { effectiveLoanEndDate } = ServiceManager.getLoanEffectiveEndDate(loan);
//             // projectedUnits = 50000 + 10 * 5000 = 100000, duration = 100000 / 20000 = 5 days
//             // End = 2025-01-01 +5 = 2025-01-06
//             expect(effectiveLoanEndDate.toISOString().split('T')[0]).toBe("2025-01-06");
//         });

//         test("should return start date for zero duration in ongoing", () => {
//             const loan = createMockLoan({ amount: 20000, status: "Ongoing", principalLeft: 20000, units: 0 });
//             DateUtil.getDaysDifference.mockReturnValue(0);
//             const { effectiveLoanEndDate } = ServiceManager.getLoanEffectiveEndDate(loan);
//             expect(effectiveLoanEndDate.toISOString().split('T')[0]).toBe("2025-01-01");
//         });
//     });
// });

// // Purpose: Tests helpers specific to standard loan calculations, including multipliers, points, and metrics.
// describe("Standard Loan Calculation Helpers", () => {

//     describe("getLimitMultiplier", () => {
//         const scenarios = [
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

//         test.each(scenarios)("should return multiplier %f for interest %i and savings %i", (interestPaid, currentSavings, expected) => {
//             const multiplier = ServiceManager.getLimitMultiplier(interestPaid, currentSavings);
//             expect(multiplier).toBe(expected);
//         });
//     });

//     describe("calculateLoanPointsNeeded", () => {
//         const scenarios = [
//             [100_000, 12, 20_000, 0.24, 12, 12], 
//             [1_000_000, 12, 5000, 0.48, 360, 360], 
//             [100_000, 24, 1000, 0.48, 24, 24], // Long duration: calculate based on formula
//             [0, 12, 0, 0.24, 0, 0], // Zero amount: 0
//             [100_000, 0, 100, 0, 0, 0], // Zero duration: 0
//             [100_000, 18, 50000, 0.36, 12, 12], // 1.5 years: switch formula
//             [100_000, 12, 0, .24, 12, 0], // Needs 12, but 0 points: spent 0
//         ];

//         test.each(scenarios)("for amount %i, duration %i, points %i, rate %f should return pointsNeeded %i and pointsSpent %i", (loanAmount, loanDuration, borrowerPoints, totalRate, expectedNeeded, expectedSpent) => {
//             const result = ServiceManager.calculateLoanPointsNeeded(loanAmount, loanDuration, borrowerPoints, totalRate);
//             expect(result.pointsNeeded).toBe(expectedNeeded);
//             expect(result.pointsSpent).toBe(expectedSpent);
//         });
//     });

//     describe("calculateStandardLoanRequestMetrics", () => {
//         const scenarios = [
//             [1_000_000, 12, 5000, 0.24, 120, 120000, 93333], // Standard: low rate, 0 points
//             [100_000, 12, 20000, 0.24, 12, 12000, 9333], // Smaller loan
//             [1_000_000, 24, 1000, 0.48, 240, 240000, 51667], // Long, points used
//             [100_000, 18, 50000, 0.36, 12, 24000, 6889], // 1.5 years
//         ];

//         test.each(scenarios)("for amount %i, duration %i, points %i should return correct metrics", (loanAmount, loanDuration, borrowerPoints, expectedRate, expectedSpent, expectedInterest, expectedInstallment) => {
//             const metrics = ServiceManager.calculateStandardLoanRequestMetrics(loanAmount, loanDuration, borrowerPoints);
//             expect(metrics.totalRate).toBe(expectedRate);
//             expect(metrics.pointsSpent).toBe(expectedSpent);
//             expect(metrics.actualInterest).toBe(expectedInterest);
//             expect(metrics.installmentAmount).toBe(expectedInstallment);
//         });
//     });
// });

// // Purpose: Tests helpers for processing loan payments, including distributions, interest due, and points consumption.
// describe("Payment Calculation Helpers", () => {

//     describe("calculateStandardLoanPrincipalPaid", () => {
//         const scenarios = [
//             [15000, 10000, 100000, 10000, 5000, 0], // Pays interest + principal
//             [5000, 10000, 100000, 5000, -5000, 0], // Short on interest: negative principal (per code)
//             [120000, 10000, 100000, 10000, 100000, 10000], // Overpay: excess
//             [0, 10000, 100000, 0, -10000, 0], // Zero payment
//         ];

//         test.each(scenarios)("should distribute payment %i with interest due %i, principal %i to interest %i, principal %i, excess %i", (payment, interestDue, principalLeft, expInterest, expPrincipal, expExcess) => {
//             const result = ServiceManager.calculateStandardLoanPrincipalPaid(payment, interestDue, principalLeft);
//             expect(result.interestPaid).toBe(expInterest);
//             expect(result.principalPaid).toBe(expPrincipal);
//             expect(result.excessAmount).toBe(expExcess);
//         });
//     });

//     describe("calculateTotalInterestDueAmount", () => {
//         const scenarios = [
//             [65, 100_000, 4040], // 65 days ~2 months +5, but months=3? Wait, calculateTotalMonthsDue(65)=2 (65/30=2, into=5<=7,=2)
//             [0, 100_000, 2000], // Zero days
//             [30, 100_000, 2000], // 1 month: ~2000
//             [365, 100_000, 26824.18], // 12 months: compound
//             [730, 100_000, 64060.6], // 25 months
//         ];

//         test.each(scenarios)("for %i days on amount %i should return interest close to %f", (days, amount, expected) => {
//             DateUtil.getDaysDifference.mockReturnValue(days);
//             const interest = ServiceManager.calculateTotalInterestDueAmount(amount, new Date(), new Date());
//             expect(interest).toBeCloseTo(expected, 0);
//         });
//     });

//     describe("calculatePointsConsumed", () => {
//         const scenarios = [
//             [50000, 50], // Standard
//             [0, 0], // Zero
//             [-1000, -1], // Negative
//             [1000.5, 1.0005], // Fractional
//         ];

//         test.each(scenarios)("should return %f points for interest %i", (interestAmount, expected) => {
//             const points = ServiceManager.calculatePointsConsumed(interestAmount);
//             expect(points).toBe(expected);
//         });
//     });

//     describe("calculatePointsMonthsDue", () => {
//         const scenarios = [
//             [450, 300, 2], // 15*30=450 ->6, 10*30=300 ->4, diff=2
//             [0, 0, 0], // Zero
//             [300, 450, 0], // Cleared > total: 0
//             [-10, 0, 0], // Negative total
//             [180, 0, 0], // Threshold: 0
//             [720, 360, 6], // 24 months=12, 12 months=6, diff=6
//         ];

//         test.each(scenarios)("should return %i for total days %i, cleared days %i", (totalDays, clearedDays, expected) => {
//             DateUtil.getDaysDifference
//                 .mockReturnValueOnce(totalDays) // for total
//                 .mockReturnValueOnce(clearedDays); // for cleared
//             const result = ServiceManager.calculatePointsMonthsDue(new Date(), new Date(), new Date());
//             expect(result).toBe(expected);
//         });
//     });
// });

test("1+1 to equal 2", ()=>{
  expect(1+1).toEqual(0)
})