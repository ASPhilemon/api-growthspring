/**
 * Calculates the difference in days between two dates.
 * @param {Date | string} date1 - The first date.
 * @param {Date | string} date2 - The second date.
 * @returns {number} The number of days difference.
 */
export function getDaysDifference(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
  
    // Set both dates to UTC to avoid timezone issues affecting day count
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  
    const oneDay = 1000 * 60 * 60 * 24; // milliseconds in a day
    const diffTime = Math.max(0, (utc2 - utc1));
    const diffDays = Math.ceil(diffTime / oneDay);
    return diffDays;
}

export function formatDateShortUS(date){
  date = new Date(date)
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return formattedDate
}

export function getToday(){
  return new Date()
}