const pool = require('../helpers/db');

/**
 * @param {number} id 
 * @returns Promise<boolean> 
 */
const isNewShow = async (id) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT COUNT(*) AS total
        FROM shows
        WHERE id = $1
    `, [id]);
    client.release();
    return parseInt(res["rows"][0]["total"]) === 0;
}

/**
 * @param {number} id 
 * @param {string} title 
 * @param {string} poster 
 * @param {string} kinds
 * @param {number} duration
 * @param {number} seasons
 */
const createShow = async (id, title, poster, kinds, duration, seasons) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO shows (id, title, poster, kinds, duration, seasons)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, title, poster, kinds, duration, seasons]);
    client.release();
}

module.exports = {
    createShow,
    isNewShow
}