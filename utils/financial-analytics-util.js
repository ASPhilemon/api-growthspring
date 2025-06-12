// src/utils/financial-analytics-util.js

// Define the financial ranges/intervals for categorization
export const ACCOUNT_BALANCE_RANGES = [
    { min: 0, max: 100000, label: "0 - 100,000" },
    { min: 100001, max: 200000, label: "100,001 - 200,000" },
    { min: 200001, max: 300000, label: "200,001 - 300,000" },
    { min: 300001, max: 400000, label: "300,001 - 400,000" },
    { min: 400001, max: 500000, label: "400,001 - 500,000" },
    { min: 500001, max: 1000000, label: "500,001 - 1,000,000" },
    { min: 1000001, max: 1500000, label: "1,000,001 - 1,500,000" },
    { min: 1500001, max: 2000000, label: "1,500,001 - 2,000,000" },
    { min: 2000001, max: 4000000, label: "2,000,001 - 4,000,000" },
    { min: 4000001, max: 6000000, label: "4,000,001 - 6,000,000" },
    { min: 6000001, max: 8000000, label: "6,000,001 - 8,000,000" },
    { min: 8000001, max: 10000000, label: "8,000,001 - 10,000,000" },
    { min: 10000001, max: 15000000, label: "10,000,001 - 15,000,000" },
    { min: 15000001, max: 20000000, label: "15,000,001 - 20,000,000" },
    { min: 20000001, max: 25000000, label: "20,000,001 - 25,000,000" },
    { min: 25000001, max: 30000000, label: "25,000,001 - 30,000,000" },
    { min: 30000001, max: Infinity, label: "Above 30,000,000" }, 
];

/**
 * Categorizes a collection of member-specific total amounts into predefined ranges.
 * @param {object} memberTotals - An object where keys are member IDs and values are their total amounts.
 * Example: { 'memberA_id': 1500000, 'memberB_id': 300000 }
 * @param {Array<object>} ranges - An array of range objects, each with 'min', 'max', and 'label'.
 * @returns {Array<object>} A list of categories with the count of members in each.
 * Example: [{ range: "0 - 100,000", count: 5 }, { range: "Above 30,000,000", count: 2 }]
 */
export function categorizeAmounts(memberTotals, ranges) {
    const categoryCounts = {};
    ranges.forEach(range => {
        categoryCounts[range.label] = 0;
    });

    // Iterate through each member's total amount
    for (const memberId in memberTotals) {
        if (Object.prototype.hasOwnProperty.call(memberTotals, memberId)) {
            const totalAmount = memberTotals[memberId];
            let foundCategory = false;

            // Find which range the total amount falls into
            for (const range of ranges) {
                if (totalAmount >= range.min && totalAmount <= range.max) {
                    categoryCounts[range.label]++;
                    foundCategory = true;
                }
            }

            if (!foundCategory && totalAmount > ranges[ranges.length - 1].max) {
                categoryCounts[ranges[ranges.length - 1].label]++;
            }
        }
    }

    // Convert the counts object into an array of objects for easier consumption
    return Object.keys(categoryCounts).map(label => ({
        range: label,
        count: categoryCounts[label]
    }));
}