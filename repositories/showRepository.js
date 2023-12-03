const pool = require('../helpers/db');

/**
 * @param {number} id 
 * @returns Promise<QueryResult> 
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
 * @param {string} kinds
 */
const createShow = async (id, title, poster, kinds) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO shows (id, title, poster, kinds)
        VALUES ($1, $2, $3, $4)
    `, [id, title, poster, kinds]);
    client.release();
}

module.exports = {
    getShowById,
    createShow
}