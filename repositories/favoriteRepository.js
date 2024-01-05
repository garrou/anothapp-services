const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @return Promise<QueryResult>
 */
const getFavorites = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster
        FROM favorites f
        JOIN shows s ON s.id = f.show_id
        WHERE f.user_id = $1
        ORDER BY s.title
    `, [userId]);
    client.release();
    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId
 * @return Promise<number>
 */
const getFavorite = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT COUNT(*) AS total
        FROM favorites
        WHERE user_id = $1 AND show_id = $2
    `, [userId, showId]);
    client.release();
    return res["rows"][0]["total"];
}

/**
 * @param {string} userId 
 * @param {number} showId 
 */
const addFavorite = async (userId, showId) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO favorites (user_id, show_id)
        VALUES ($1, $2)
    `, [userId, showId]);
    client.release();
}

/**
 * @param {string} userId 
 * @param {number} showId 
 */
const deleteFavorite = async (userId, showId) => {
    const client = await pool.connect();
    await client.query(`
        DELETE FROM favorites
        WHERE user_id = $1 AND show_id = $2
    `, [userId, showId]);
    client.release();
}

module.exports = {
    addFavorite,
    deleteFavorite,
    getFavorite,
    getFavorites
}