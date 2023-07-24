const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @returns Promise<QueryResult>
 */
const getShowsToContinueByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, title, poster, nb
        FROM users_towatch
        JOIN shows ON id = show_id
        WHERE user_id = $1
        ORDER BY title
    `, [userId]);
    client.release();

    return res;
}

module.exports = {
    getShowsToContinueByUserId
}