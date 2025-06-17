// src/services/earnings-service/service.js (New File)

import { ACCOUNT_BALANCE_RANGES, categorizeAmounts } from "../../utils/financial-analytics-util.js";


/**
 * Fetches and processes earning records to categorize members based on their total earning amounts,
 * and also returns each member's total earnings with names.
 *
 * @param {Array<object>} earningRecords - An array of earning documents, ideally already filtered.
 * Expected structure: { member: { id: '...', name: '...' }, amount: number, ... }
 * @returns {Promise<object>} An object containing:
 * - standings: Array of earning account standings by range.
 * - memberTotals: Array of objects where each object is { id: string, name: string, total: number }.
 */
export async function generateEarningAccountStandings(earningRecords) {
    const memberEarningTotalsById = {}; // Aggregate by ID
    const memberInfoMap = {};           // Map to store member's name

    earningRecords.forEach(record => {
        const memberId = record.member.id.toString(); // Assuming 'member' field has 'id'
        const memberName = record.member.name;

        if (!memberEarningTotalsById[memberId]) {
            memberEarningTotalsById[memberId] = 0;
            memberInfoMap[memberId] = memberName;
        }
        memberEarningTotalsById[memberId] += record.amount;
    });

    const memberEarningTotals = Object.keys(memberEarningTotalsById).map(memberId => ({
        id: memberId,
        name: memberInfoMap[memberId],
        total: memberEarningTotalsById[memberId]
    }));

    const earningStandings = categorizeAmounts(memberEarningTotalsById, ACCOUNT_BALANCE_RANGES);

    return {
        standings: earningStandings,
        memberTotals: memberEarningTotals
    };
}

// ... (other functions related to earnings) ...
