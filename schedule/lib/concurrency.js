/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once, using a fixed pool
 * of workers each consuming from the shared queue. A single item failing never stops the
 * others - each result is reported as fulfilled/rejected, similar to Promise.allSettled.
 *
 * A bounded pool is used instead of a plain `Promise.all(items.map(fn))` because firing every
 * request at once overwhelmed the previous tool's small host and the BetaSeries API; this keeps
 * the "as parallel as possible" benefit while capping how many requests run simultaneously.
 *
 * @param {any[]} items
 * @param {number} limit
 * @param {(item: any, index: number) => Promise<any>} fn
 * @returns {Promise<({status: "fulfilled", value: any}|{status: "rejected", reason: any})[]>}
 */
const mapWithConcurrency = async (items, limit, fn) => {
    const results = new Array(items.length);
    let cursor = 0;

    const worker = async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;

            try {
                results[index] = {status: "fulfilled", value: await fn(items[index], index)};
            } catch (reason) {
                results[index] = {status: "rejected", reason};
            }
        }
    };
    const workers = Array.from({length: Math.max(1, Math.min(limit, items.length))}, worker);
    await Promise.all(workers);
    return results;
};

export default mapWithConcurrency;
