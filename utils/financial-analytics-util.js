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

// GET_TOTALS_FROM_RECORDS (auto-detect depositor key, backward-compatible)
export function getTotalSumsAndSort(records, givenDate, ...rest) {
    if (!Array.isArray(records) || records.length === 0) {
      return {
        totalSumAll: {},
        yearsSums: {},
        recordsByYear: {},
        monthlySums: {},
        sortedRecords: [],
      };
    }
  
    // If last arg is options object, pop it
    let options = {};
    if (rest.length && typeof rest[rest.length - 1] === 'object' && !Array.isArray(rest[rest.length - 1])) {
      options = rest.pop();
    }
  
    const fields = rest; // e.g. 'amount'
    const explicitUniqueBy = options.uniqueBy; // e.g. 'depositor_id' or 'depositor_name' or function(record)
    const uniqueByFn = typeof explicitUniqueBy === 'function' ? explicitUniqueBy : null;
  
    // helper: try to detect depositor field name from a sample record
    function detectDepositorKey(sample) {
      if (!sample || typeof sample !== 'object') return null;
      const candidates = [
        'depositor_id', 'depositorId', 'depositor._id', 'depositorId',
        'depositor_name', 'depositorName', 'depositor', 'userId', 'user_id', 'memberId', 'member_id', 'ownerId'
      ];
      for (const key of candidates) {
        // support nested paths like 'depositor._id'
        if (key.includes('.')) {
          const val = key.split('.').reduce((o, k) => (o ? o[k] : undefined), sample);
          if (val !== undefined && val !== null) return key;
        } else {
          if (Object.prototype.hasOwnProperty.call(sample, key) && sample[key] !== undefined && sample[key] !== null) return key;
        }
      }
      return null;
    }
  
    // resolve depositor key (string path) if explicit provided
    function resolveKeyFromRecord(record, key) {
      if (!key) return undefined;
      if (typeof key === 'function') return key(record);
      if (key.includes('.')) {
        return key.split('.').reduce((o, k) => (o ? o[k] : undefined), record);
      }
      return record[key];
    }
  
    // If no explicit uniqueBy, try auto-detect from first few records
    let uniqueByKey = null;
    if (!explicitUniqueBy) {
      for (let i = 0; i < Math.min(10, records.length); i++) {
        const k = detectDepositorKey(records[i]);
        if (k) { uniqueByKey = k; break; }
      }
    } else if (typeof explicitUniqueBy === 'string') {
      uniqueByKey = explicitUniqueBy;
    } // if explicitUniqueBy is function we use uniqueByFn
  
    const totalSumAll = {};
    const yearsSums = {};
    const recordsByYear = {};
    const monthlySums = {};
    const monthlyDepositorSets = {}; // { year: { monthName: Set } }
  
    const sortedRecords = records.slice().sort((a, b) => new Date(b[givenDate]) - new Date(a[givenDate]));
  
    sortedRecords.forEach(record => {
      const date = new Date(record[givenDate]);
      const year = date.getFullYear();
      const monthName = date.toLocaleString('default', { month: 'long' });
  
      // ensure containers
      if (!yearsSums[year]) yearsSums[year] = {};
      if (!recordsByYear[year]) recordsByYear[year] = [];
      if (!monthlySums[year]) monthlySums[year] = {};
      if (!monthlySums[year][monthName]) monthlySums[year][monthName] = {};
      if (!monthlyDepositorSets[year]) monthlyDepositorSets[year] = {};
      if (!monthlyDepositorSets[year][monthName]) monthlyDepositorSets[year][monthName] = new Set();
  
      // accumulate fields
      fields.forEach(field => {
        if (!totalSumAll[field]) totalSumAll[field] = 0;
        totalSumAll[field] += Number(record[field] || 0);
  
        if (!yearsSums[year][field]) yearsSums[year][field] = 0;
        yearsSums[year][field] += Number(record[field] || 0);
  
        if (!monthlySums[year][monthName][field]) monthlySums[year][monthName][field] = 0;
        monthlySums[year][monthName][field] += Number(record[field] || 0);
      });
  
      recordsByYear[year].push(record);
  
      // depositor key handling (explicit function, explicit key, or auto-detected key)
      let depositorKeyValue;
      if (uniqueByFn) {
        depositorKeyValue = uniqueByFn(record);
      } else if (uniqueByKey) {
        depositorKeyValue = resolveKeyFromRecord(record, uniqueByKey);
      } else {
        // no depositor detection available -> try some common fields as fallback
        depositorKeyValue =
          record.depositor_id ?? record.depositorId ?? record.depositor?._id ?? record.depositor_name ?? record.depositorName ?? record.userId ?? record.memberId ?? null;
      }
      if (depositorKeyValue !== undefined && depositorKeyValue !== null) {
        monthlyDepositorSets[year][monthName].add(String(depositorKeyValue));
      }
    });
  
    // attach depositor counts per month
    for (const yr of Object.keys(monthlyDepositorSets)) {
      for (const mn of Object.keys(monthlyDepositorSets[yr])) {
        if (!monthlySums[yr]) monthlySums[yr] = {};
        if (!monthlySums[yr][mn]) monthlySums[yr][mn] = {};
        monthlySums[yr][mn].depositors = monthlyDepositorSets[yr][mn].size;
      }
    }
  
    // filter months with nothing
    for (const year in monthlySums) {
      for (const month in monthlySums[year]) {
        let hasNonZeroValue = false;
        for (const field in monthlySums[year][month]) {
          if (monthlySums[year][month][field] !== 0) {
            hasNonZeroValue = true; break;
          }
        }
        if (!hasNonZeroValue) delete monthlySums[year][month];
      }
    }
  
    return {
      totalSumAll,
      yearsSums,
      recordsByYear,
      monthlySums,
      sortedRecords,
    };
  }
  