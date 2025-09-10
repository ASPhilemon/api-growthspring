// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();



const CONSTANTS = {

 // Loan related constants

 MONTHLY_LENDING_RATE: Number(process.env.MONTHLY_LENDING_RATE),

 TEMPORARY_SAVINGS_LOAN_FRACTION: Number(process.env.TEMPORARY_SAVINGS_LOAN_FRACTION),

 MAX_LENDING_RATE: Number(process.env.MAX_LENDING_RATE),

 MIN_LENDING_RATE: Number(process.env.MIN_LENDING_RATE),

 ANNUAL_TAX_RATE: Number(process.env.ANNUAL_TAX_RATE),

 MAX_CREDITS: Number(process.env.MAX_CREDITS),

 MIN_DISCOUNT: Number(process.env.MIN_DISCOUNT),

 DISCOUNT_PROFIT_PERCENTAGE: Number(process.env.DISCOUNT_PROFIT_PERCENTAGE),

 LOAN_RISK: Number(process.env.LOAN_RISK),

 MEMBERS_SERVED_PERCENTAGE: Number(process.env.MEMBERS_SERVED_PERCENTAGE),

 LOAN_MULTIPLE: Number(process.env.LOAN_MULTIPLE),

 ONE_MONTH_DAYS: Number(process.env.ONE_MONTH_DAYS),

 GRACE_PERIOD_DAYS: Number(process.env.GRACE_PERIOD_DAYS),

 ONE_YEAR_MONTH_THRESHOLD: Number(process.env.ONE_YEAR_MONTH_THRESHOLD),

TWO_YEAR_MONTH_THRESHOLD: Number(process.env.TWO_YEAR_MONTH_THRESHOLD),

TWO_YEAR_MONTH_THRESHOLD: Number(process.env.TWO_YEAR_MONTH_THRESHOLD),

MIN_EXCESS_DEPOSIT_THRESHOLD: Number(process.env.MIN_EXCESS_DEPOSIT_THRESHOLD),

POINTS_VALUE_PER_UNIT: Number(process.env.POINTS_VALUE_PER_UNIT),

INTEREST_MULTIPLIER_RULES: {
    minInterestRatio: Number(process.env.IMR_MIN_INTEREST_RATIO),
    maxInterestRatio: Number(process.env.IMR_MAX_INTEREST_RATIO),
    maxMultiplier: Number(process.env.IMR_MAX_MULTIPLIER),
    minMultiplier: Number(process.env.IMR_MIN_MULTIPLIER)
},

};



export default CONSTANTS;