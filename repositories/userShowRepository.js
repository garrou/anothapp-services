const pool = require('../helpers/db');

const getByUserIdByShowId = async (userId, showId) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT *
            FROM users_shows
            WHERE user_id = $1 AND show_id = $2
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
 */
const create = async (userId, showId) => {
    try {
        const client = await pool.connect();
        await client.query(`
            INSERT INTO users_shows (user_id, show_id)
            VALUES ($1, $2)
        `, [userId, showId]);
        client.release();
    } catch (err) {
        throw err;
    }
}

/**
 * @param {string} userId 
 * @param {number} showId 
 */
const deleteByUserIdShowId = async (userId, showId) => {
    try {
        const client = await pool.connect();
        await client.query(`
            DELETE FROM users_shows
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId]);
        client.release();
    } catch (err) {
        throw err;
    }
}

/**
 * @param {string} userId 
 * @returns QueryResult
 */
const getShowsByUserId = async (userId) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT *
            FROM users_shows
            JOIN shows ON id = show_id
            WHERE user_id = $1
            ORDER BY users_shows.added_at DESC
        `, [userId]);

        return res;
    } catch (err) {
        throw err;
    }
}

/**
 * @param {string} userId 
 * @param {string} title
 * @returns QueryResult
 */
const getShowsByUserIdByTitle = async (userId, title) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT *
            FROM users_shows
            JOIN shows ON id = show_id
            WHERE user_id = $1
            AND title LIKE $2
            ORDER BY added_at DESC
        `, [userId, `%${title}%`]);

        return res;
    } catch (err) {
        throw err;
    }
}

/**
 * @param {string} userId 
 * @returns QueryResult
 */
const getByUserId = async (userId) => {
    try {   
        const client = await pool.connect();
        const res = await client.query(`
            SELECT show_id
            FROM users_shows
            WHERE user_id = $1
        `, [userId]);
        client.release();

        return res;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    getByUserId,
    getByUserIdByShowId,
    create,
    deleteByUserIdShowId,
    getShowsByUserId,
    getShowsByUserIdByTitle
}