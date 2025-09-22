// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();



const CONSTANTS = {

 // Loan related constants

 MONTHLY_LENDING_RATE: 0.02,

 TEMPORARY_SAVINGS_LOAN_FRACTION: 0.4,

 MAX_LENDING_RATE: 0.2,

 MIN_LENDING_RATE: 0.12,

 ANNUAL_TAX_RATE: 0.2,

 MAX_CREDITS: 500000,

 MIN_DISCOUNT: 0.1,

 DISCOUNT_PROFIT_PERCENTAGE: 0.005,

 LOAN_RISK: 0.03,

 MEMBERS_SERVED_PERCENTAGE: 30,

 LOAN_MULTIPLE: 10,

 ONE_MONTH_DAYS: 30,

 GRACE_PERIOD_DAYS: 7,

 ONE_YEAR_MONTH_THRESHOLD: 6,

TWO_YEAR_MONTH_THRESHOLD: 18,

MIN_EXCESS_DEPOSIT_THRESHOLD: 5000,

POINTS_VALUE_PER_UNIT: 1000,

INTEREST_MULTIPLIER_RULES: {
    minInterestRatio: 0.18,
    maxInterestRatio: 0.36,
    maxMultiplier: 1.7,
    minMultiplier: 1.2
},

};



export default CONSTANTS;