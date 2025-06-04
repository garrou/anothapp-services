import db from "../config/db.js";
import Season from "../models/season.js";

export default class SeasonRepository {

    /**
     * @param {string} userId
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    deleteSeasonById = async (userId, id) => {
        const res = await db.query(`
            DELETE FROM users_seasons
            WHERE id = $1 AND user_id = $2
        `, [id, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<Season|null>}
     */
    getSeasonByShowIdByNumber = async (showId, number) => {
        const res = await db.query(`
            SELECT *
            FROM seasons
            WHERE show_id = $1 AND number = $2
        `, [showId, number]);
        return res.rowCount === 1 ? new Season(res.rows[0]) : null;
    }

    /**
     * @param {number} episodes
     * @param {number} number
     * @param {string} image
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    createSeason = async (episodes, number, image, showId) => {
        const res = await db.query(`
            INSERT INTO seasons (episodes, number, image, show_id)
            VALUES ($1, $2, $3, $4)
        `, [episodes, number, image, showId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @param {number} platform
     * @param {string} viewedAt
     * @returns {Promise<boolean>}
     */
    updateSeason = async (userId, id, platform, viewedAt) => {
        const res = await db.query(`
            UPDATE users_seasons
            SET platform_id = $1, added_at = $4
            WHERE id = $2 AND user_id = $3
        `, [platform, id, userId, viewedAt]);
        return res.rowCount === 1;
    }
}