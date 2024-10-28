const express = require('express');
const Loans = require('../Models/loans');
const Users = require('../auth/models/UserModel');
const Constants = require('../Models/constants'); 

const router = express.Router();

// Loan Amount Calculation API
router.post('/get-loan-amount', async (req, res) => {
  const { borrower_name_id } = req.body;
  try {
    // Fetch the member by ID
    const member = await Users.findOne({ _id: borrower_name_id });
    if (!member) {
      return res.status(404).json({ msg: 'Member not found' });
    }

    // Calculate loan limit
    const loanLimit = await calculateLoanAmount(member);

    res.status(200).json({ loan_limit: loanLimit });
  } catch (error) {
    console.error("Error calculating loan limit:", error);
    res.status(500).json({ msg: `Error calculating loan limit: ${error.message}` });
  }
});

// Function to calculate loan amount
async function calculateLoanAmount(member) {
  try {
    const constants = await Constants.findOne();
    const club = await Users.find({});//Get all members' records
    const membersCount = club.length - 2;//Subtract Club Fund and Example user from the count.
    const clubWorth = club.reduce((total, user) => total + user.investmentAmount, 0);//Example user has 0 worth so it is not an issue.
    
    let usedPool = 0;
    let benefiters = 0;
    const allDebts = await Loans.find({ loan_status: "Ongoing" });

    for (const clubMember of club) {
      const memberDebts = allDebts.filter(loan => loan.borrower_name === clubMember.fullName);
      const memberDebtsTotal = memberDebts.reduce((total, loan) => total + loan.principal_left, 0);//Total all pending principle from a member's loans
      const usedPortion = Math.max(0, memberDebtsTotal - clubMember.investmentAmount);//Subtract member worth from all pending principle to get what others contributed
      if (usedPortion > 0) benefiters += 1;//Check if other members contributed. If so increase those who have used the pool.
      usedPool += usedPortion;//This adds to the amount used from the pool got from other members
    }

    const benefitingMembers = constants.members_served_percentage * membersCount / 100;//This number is based on Club policy. What percentage of members can access the pool?
    const debts = await Loans.find({ borrower_name: member.fullName, loan_status: "Ongoing" });
    const totalDebt = debts.reduce((total, loan) => total + loan.principal_left, 0);//Total all loans of the member currently asking for a loan
    const allDebt = allDebts.reduce((total, loan) => total + loan.principal_left, 0);//Total all ongoing loans of the club

    const availablePool = constants.loan_risk * (clubWorth - member.investmentAmount) / 100;//What percentage of the Club worth can be lent out.?
    
    let risk = (usedPool / (clubWorth + usedPool - allDebt)) * member.investmentAmount/member.investmentAmount;//Check the current usage of the available pool
    const limit = benefiters < Math.round(benefitingMembers) && risk <= constants.loan_risk/100 //Are the benefiting members less than the policy, and the amount lent less than the policy?
      ? Math.min(member.investmentAmount * constants.loan_multiple - totalDebt, (member.investmentAmount + (availablePool/ benefitingMembers) - totalDebt)) //If yes, add the top-up the Club gives to the member's savings, less their current debt
      : Math.max(0, member.investmentAmount - (usedPool / (clubWorth + usedPool - allDebt)) * member.investmentAmount - totalDebt);//Otherwise, give them the remainder of their savings not contributed which should be 70%, or nothing if they already took it

    return limit;
  } catch (error) {
    console.error("Error occurred while calculating loan limit:", error);
    return 0;
  }
}

module.exports = router;
