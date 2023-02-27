const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns QueryResult
 */
const getByUserIdByShowId = async (userId, showId) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT *
            FROM users_seasons
            JOIN seasons ON seasons.show_id = users_seasons.show_id 
            AND seasons.number = users_seasons.number
            WHERE user_id = $1 AND show_id = $2
            ORDER 
        `, [userId, showId]);
        client.release();

        return res;
    } catch (err) {
        throw err;
    }
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @param {number} number 
 */
const create = async (userId, showId, number) => {
    try {
        const client = await pool.connect();
        await client.query(`
            INSERT INTO users_seasons (user_id, show_id, number)
            VALUES ($1, $2, $3)
        `, [userId, showId, number]);
        client.release();
    } catch (err) {
        throw err;
    }
}

module.exports = {
    create,
    getByUserIdByShowId
}