import pool from "../config/db.js";

export default class PlatformRepository {
    /**
     * @returns Promise<any[]>
     */
    getPlatforms = async () => {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT id AS pid, name, logo
            FROM platforms
            ORDER BY name
        `);
        client.release();
        return res["rows"];
    }
}