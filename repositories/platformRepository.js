import db from "../config/db.js";
import Platform from "../models/platform.js";

export default class PlatformRepository {
    /**
     * @returns {Promise<Platform[]>}
     */
    getPlatforms = async () => {
        const res = await db.query(`
            SELECT id AS pid, name, logo
            FROM platforms
            ORDER BY name
        `);
        return res.rows.map((row) => new Platform(row));
    }
}