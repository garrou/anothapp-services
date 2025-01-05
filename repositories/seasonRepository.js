import pool from "../config/db.js";

export default class SeasonRepository {

    /**
     * @param {string} userId
     * @param {number} id
     */
    deleteSeasonById = async (userId, id) => {
        const client = await pool.connect();
        await client.query(`
        DELETE FROM users_seasons
        WHERE id = $1 AND user_id = $2
    `, [id, userId]);
        client.release();
    }

    /**
     * @param {number} showId
     * @param {number} number
     * @returns Promise<any[]>
     */
    getSeasonByShowIdByNumber = async (showId, number) => {
        const client = await pool.connect();
        const res = await client.query(`
        SELECT *
        FROM seasons
        WHERE show_id = $1 AND number = $2
    `, [showId, number]);
        client.release();
        return res["rows"];
    }

    /**
     * @param {number} episodes
     * @param {number} number
     * @param {string} image
     * @param {number} showId
     */
    createSeason = async (episodes, number, image, showId) => {
        const client = await pool.connect();
        await client.query(`
        INSERT INTO seasons (episodes, number, image, show_id)
        VALUES ($1, $2, $3, $4)
    `, [episodes, number, image, showId]);
        client.release();
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @param {number} platform
     */
    updateSeason = async (userId, id, platform) => {
        const client = await pool.connect();
        await client.query(`
        UPDATE users_seasons
        SET platform_id = $1
        WHERE id = $2 AND user_id = $3
    `, [platform, id, userId]);
        client.release();
    }
}