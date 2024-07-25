const pool = require('../helpers/db');

/**
 * @param {number} id 
 * @param {string} userId
 */
const deleteSeasonById = async (id, userId) => {
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
        VALUES ($1, $2, $3, $4)
    `, [episodes, number, image, showId]);
    client.release();
}

/**
 * @param {number} id 
 * @param {string} userId 
 * @param {number} plateform 
 */
const updateSeason = async (id, userId, plateform) => {
    const client = await pool.connect();
    await client.query(`
        UPDATE users_seasons
        SET platform = $1
        WHERE id = $2 AND user_id = $3
    `, [plateform, id, userId]);
    client.release();
}

module.exports = {
    createSeason,
    deleteSeasonById,
    updateSeason,
    getSeasonByShowIdByNumber
}