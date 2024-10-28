const express = require('express'); 

const router = express.Router();

// Loan Limit Calculation API
router.post('/get-loan-limit', async (req, res) => {
  const { member, constants, club, allDebts, debts } = req.body;

  try {
    // Calculate loan limit
    const loanLimit = getLoanLimit(member, constants, club, allDebts, debts);

    res.status(200).json({ max_limit: loanLimit });
  } catch (error) {
    console.error("Error calculating loan limit:", error);
    res.status(500).json({ msg: `Error calculating loan limit: ${error.message}` });
  }
});

function getLoanLimit(member, constants, club, allDebts, debts) {
    try { 

        // Calculate total number of members (excluding the club Fund and example)
        const membersCount = club.length - 2;

        // Calculate total club worth
        const clubWorth = club.reduce((total, user) => total + user.investmentAmount, 0);

        // Calculate number of benefiting membersgot as a percentage of total number of members
        const benefitingMembers = constants.members_served_percentage * membersCount / 100;

        // Calculate total debt for the member
        const totalDebt = debts.reduce((total, loan) => total + loan.principal_left, 0);

        // Calculate available pool
        const availablePool = constants.loan_risk * (clubWorth - member.investmentAmount) / 100;

        // Calculate loan limit. This is the maximum amount a member can get in ideal conditions. Loan multiple is the multiplier based on policy, say 5x savings
        const limit = Math.min(member.investmentAmount * constants.loan_multiple - totalDebt, (member.investmentAmount + (availablePool/ benefitingMembers) - totalDebt));

        return limit;
    } catch (error) {
        console.error("Error occurred while calculating loan limit:", error);
        // Return a default value or handle errors more gracefully
        return 0;
    }
}

module.exports = router;
