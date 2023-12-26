const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @return Promise<QueryResult>
 */
const getFavoritesByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster
        FROM favorites f
        JOIN shows s ON s.id = f.show_id
        WHERE f.user_id = $1
    `, [userId]);
    client.release();
    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 */
const addFavorites = async (userId, showId) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO favorites (user_id, show_id)
        VALUES ($1, $2)
    `, [userId, showId]);
    client.release();
}

module.exports = {
    addFavorites,
    getFavoritesByUserId
}