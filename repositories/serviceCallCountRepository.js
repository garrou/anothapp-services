import db from "../config/db.js";

const KNOWN_SERVICES = ["mailer", "betaseries", "export", "import"];

export default class ServiceCallCountRepository {

    /**
     * @param {string} service
     * @returns {Promise<void>}
     */
    increment = async (service) => {
        await db.query(`
            INSERT INTO service_call_counts (service, day, count)
            VALUES ($1, CURRENT_DATE, 1)
            ON CONFLICT (service, day) DO UPDATE SET count = service_call_counts.count + 1
        `, [service]);
    }

    /**
     * @param {number} days how many days of daily history to include - the lifetime total is
     *   unaffected by this window, it's always summed over every day on record
     * @returns {Promise<Object<string, {total: number, history: {day: string, count: number}[]}>>}
     *   always keyed by every known service, even ones with no calls yet
     */
    getAll = async (days = 30) => {
        const [totalsRes, historyRes] = await Promise.all([
            db.query(`SELECT service, SUM(count) AS total FROM service_call_counts GROUP BY service`),
            db.query(`
                SELECT service, day, count FROM service_call_counts
                WHERE day >= CURRENT_DATE - ($1 * INTERVAL '1 day')
                ORDER BY day
            `, [days]),
        ]);
        const result = {};
        KNOWN_SERVICES.forEach((service) => { result[service] = {total: 0, history: []}; });

        totalsRes.rows.forEach((row) => {
            if (result[row.service]) {
                result[row.service].total = parseInt(row.total);
            }
        });
        historyRes.rows.forEach((row) => {
            if (result[row.service]) {
                result[row.service].history.push({day: row.day, count: parseInt(row.count)});
            }
        });
        return result;
    }
}
