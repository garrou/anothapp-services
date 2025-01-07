import db from "../config/db.js";

export default class PlatformRepository {
    /**
     * @returns {Promise<any[]>}
     */
    getPlatforms = async () => {
        const res = await db.query(`
            SELECT id AS pid, name, logo
            FROM platforms
            ORDER BY name
        `);
        return res.rows;
    }
}