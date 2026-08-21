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

    /**
     * @returns {Promise<any[]>}
     */
    getAllSeasons = async () => {
        const res = await db.query(`
            SELECT number, episodes, image, show_id
            FROM seasons
            ORDER BY show_id, number
        `);
        return res.rows;
    }

    /**
     * @param {number} showId
     * @param {number} number
     * @param {number} episodes
     * @param {string} image empty string keeps the current image
     * @returns {Promise<boolean>}
     */
    updateSeasonEpisodesImage = async (showId, number, episodes, image) => {
        const res = await db.query(`
            UPDATE seasons
            SET episodes = $3, image = COALESCE(NULLIF($4, ''), image)
            WHERE show_id = $1 AND number = $2
        `, [showId, number, episodes, image]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<boolean>}
     */
    deleteSeasonByShowIdByNumber = async (showId, number) => {
        const res = await db.query(`
            DELETE FROM seasons WHERE show_id = $1 AND number = $2
        `, [showId, number]);
        return res.rowCount === 1;
    }

    /**
     * @returns {Promise<number>} number of seasons updated
     */
    fillMissingSeasonImages = async () => {
        const res = await db.query(`
            UPDATE seasons se
            SET image = (SELECT poster FROM shows s WHERE s.id = se.show_id)
            WHERE image IS NULL OR image = ''
        `);
        return res.rowCount;
    }
}