import db from "../config/db.js";

export default class DatabaseRepository {

    /**
     * @returns {Promise<string>}
     */
    getDatabaseSize = async () => {
        const res = await db.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) AS size
        `);
        return res.rows[0]["size"];
    }

    /**
     * @returns {Promise<number>} current database size, in bytes
     */
    getDatabaseSizeBytes = async () => {
        const res = await db.query(`SELECT pg_database_size(current_database()) AS size`);
        return parseInt(res.rows[0]["size"]);
    }

    /**
     * @param {number} sizeBytes
     * @returns {Promise<void>}
     */
    recordSizeSnapshot = async (sizeBytes) => {
        await db.query(`INSERT INTO database_size_history (size_bytes) VALUES ($1)`, [sizeBytes]);
    }

    /**
     * @param {number} limit
     * @returns {Promise<{recordedAt: string, sizeBytes: number}[]>} oldest first
     */
    getSizeHistory = async (limit = 52) => {
        const res = await db.query(`
            SELECT recorded_at, size_bytes
            FROM database_size_history
            ORDER BY recorded_at DESC
            LIMIT $1
        `, [limit]);
        return res.rows.reverse().map((row) => ({
            recordedAt: row["recorded_at"],
            sizeBytes: parseInt(row["size_bytes"]),
        }));
    }
}
