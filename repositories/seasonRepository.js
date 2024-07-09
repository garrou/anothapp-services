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
 * @returns Promise<any[]>
 */
const getSeasonByShowIdByNumber = async (showId, number) => {
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
const createSeason = async (episodes, number, image, showId) => {
    const client = await pool.connect();

    await client.query(`
        INSERT INTO seasons (episodes, number, image, show_id)
        VALUES ($1, $2, $3, $4, $5)
    `, [episodes, number, image, showId, duration]);
    client.release();
}

module.exports = {
    createSeason,
    deleteSeasonById,
    getSeasonByShowIdByNumber
}