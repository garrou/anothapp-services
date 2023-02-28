const pool = require('../helpers/db');

/**
 * @param {number} id 
 * @returns QueryResult 
 */
const getById = async (id) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT *
            FROM shows
            WHERE id = $1
        `, [id]);
        client.release();
        
        return res;
    } catch (err) {
        throw err;
    }
}

/**
 * @param {number} id 
 * @param {string} title 
 * @param {string} poster 
 */
const create = async (id, title, poster) => {
    try {
        const client = await pool.connect();
        await client.query(`
            INSERT INTO shows (id, title, poster)
            VALUES ($1, $2, $3)
        `, [id, title, poster]);
        client.release();
    } catch (err) {
        throw err;
    }
}

module.exports = {
    getById,
    create
}