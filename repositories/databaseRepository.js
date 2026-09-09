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
}
