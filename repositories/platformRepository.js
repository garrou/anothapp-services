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

    /**
     * @param {number} id
     * @param {string} name
     * @param {string} logo
     * @returns {Promise<boolean>}
     */
    upsertPlatform = async (id, name, logo) => {
        const res = await db.query(`
            INSERT INTO platforms (id, name, logo)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, logo = EXCLUDED.logo
        `, [id, name, logo]);
        return res.rowCount === 1;
    }
}