import dotenv from 'dotenv'; 

// Load environment variables from .env file
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
};

export default CONSTANTS;