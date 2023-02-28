const pool = require('../helpers/db');

/**
 * @param {number} id 
 * @returns QueryResult 
 */
const getShowById = async (id) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT *
        FROM shows
        WHERE id = $1
    `, [id]);
    client.release();
        
    return res;
}

/**
 * @param {number} id 
 * @param {string} title 
 * @param {string} poster 
 */
const createShow = async (id, title, poster) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO shows (id, title, poster)
        VALUES ($1, $2, $3)
    `, [id, title, poster]);
    client.release();
}

module.exports = {
    getShowById,
    createShow
}