const pool = require('../helpers/db');

/**
 * @param {number} id 
 */
const deleteSeasonById = async (id) => {
    const client = await pool.connect();
    await client.query(`
        DELETE FROM users_seasons
        WHERE id = $1
    `, [id]);
    client.release();
}

/**
 * @param {number} showId 
 * @param {number} number 
 * @returns Promise<QueryResult>
 */
const getSeasonByShowIdByNumber = async (showId, number) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT *
        FROM seasons
        WHERE show_id = $1 AND number = $2
    `, [showId, number]);
    client.release();

    return res;
}

/**
 * @param {number} episode 
 * @param {number} number 
 * @param {string} image 
 * @param {number} showId 
 * @param {number} epDuration 
 */
const createSeason = async (episode, number, image, showId, epDuration) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO seasons (episode, number, image, show_id, ep_duration)
        VALUES ($1, $2, $3, $4, $5)
    `, [episode, number, image, showId, epDuration]);
    client.release();
}

module.exports = {
    createSeason,
    deleteSeasonById,
    getSeasonByShowIdByNumber
}