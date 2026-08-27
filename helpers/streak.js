const DAY_MS = 24 * 60 * 60 * 1000;

const toTime = (day) => new Date(`${day}T00:00:00Z`).getTime();

/**
 * @param {string[]} days dates as 'YYYY-MM-DD', any order, duplicates allowed
 * @returns {{current: number, longest: number}} current streak (consecutive days up to
 * today or yesterday) and longest streak ever, in days
 */
const computeStreak = (days) => {
    const sorted = [...new Set(days)].sort();

    if (sorted.length === 0) {
        return {current: 0, longest: 0};
    }
    let run = 1;
    let longest = 1;

    for (let i = 1; i < sorted.length; i++) {
        run = (toTime(sorted[i]) - toTime(sorted[i - 1])) / DAY_MS === 1 ? run + 1 : 1;
        longest = Math.max(longest, run);
    }
    const today = toTime(new Date().toISOString().slice(0, 10));
    const gapFromToday = (today - toTime(sorted[sorted.length - 1])) / DAY_MS;

    return {current: gapFromToday <= 1 ? run : 0, longest};
}

export {computeStreak};
