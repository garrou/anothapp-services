import db from "../config/db.js";
import ServiceError from "../helpers/serviceError.js";
import Platform from "../models/platform.js";

export default class UserPlatformRepository {

    /**
     * @param {string} userId 
     * @param {number} platformId 
     * @returns {Promise<boolean>}
     */
    addUserPlatforms = async (userId, platformId) => {
        const res = await db.query(`
            INSERT INTO users_platforms (user_id, platform_id)
            VALUES ($1, $2)
        `, [userId, platformId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId 
     * @returns {Promise<number[]>}
     */
    getUserPlatforms = async (userId) => {
        const res = await db.query(`
            SELECT id
            FROM platforms
            JOIN users_platforms ON platforms.id = users_platforms.platform_id
            WHERE user_id = $1
        `, [userId]);
        return res.rows.map((row) => row.id);
    }

    /**
     * @param {string} userId 
     * @param {number} platformId 
     * @returns {Promise<boolean>}
     */
    deleteUserPlatforms = async (userId, platformId) => {
        const res = await db.query(`
            DELETE FROM users_platforms 
            WHERE user_id = $1 AND platform_id = $2
        `, [userId, platformId]);
        return res.rowCount === 1;
    }
}