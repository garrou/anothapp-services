const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns Promise<QueryResult>
 */
const getShowByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT show_id
        FROM users_shows
        WHERE user_id = $1 AND show_id = $2
    `, [userId, showId]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 */
const create = async (userId, showId) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO users_shows (user_id, show_id)
        VALUES ($1, $2)
    `, [userId, showId]);
    client.release();
}

/**
 * @param {string} userId 
 * @param {number} showId 
 */
const deleteByUserIdShowId = async (userId, showId) => {
    const client = await pool.connect();
    await client.query(`
        DELETE FROM users_shows
        WHERE user_id = $1 AND show_id = $2
    `, [userId, showId]);
    client.release();
}

/**
 * @param {string} userId
 * @returns Promise<QueryResult>
 */
const getShowsByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, title, poster
        FROM users_shows
        JOIN shows ON id = show_id
        WHERE user_id = $1
        ORDER BY users_shows.added_at DESC
    `, [userId]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @param {string} title
 * @returns Promise<QueryResult>
 */
const getShowsByUserIdByTitle = async (userId, title) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, title, poster
        FROM users_shows
        JOIN shows ON id = show_id
        WHERE user_id = $1
        AND UPPER(title) LIKE UPPER($2)
        ORDER BY added_at DESC
    `, [userId, `%${title}%`]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @returns Promise<QueryResult>
 */
const getByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT show_id
        FROM users_shows
        WHERE user_id = $1
    `, [userId]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @param {boolean} isContinue 
 * @returns Promise<QueryResult>
 */
const getByUserIdByContinue = async (userId, isContinue) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT shows.id AS id, title, poster, MAX(number) AS number
        FROM users_shows
        JOIN users_seasons ON users_seasons.show_id = users_shows.show_id
        JOIN shows ON users_shows.show_id = shows.id
        WHERE users_shows.user_id = $1 AND users_shows.continue = $2
        GROUP BY shows.id, title, poster
    `, [userId, isContinue]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @returns Promise<QueryResult>
 */
const getNotStartedShowsByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(` 
        SELECT id, title, poster
        FROM shows
        JOIN users_shows ON users_shows.show_id = shows.id
        WHERE users_shows.user_id = $1
        AND NOT EXISTS (
            SELECT *
            FROM users_seasons
            WHERE users_seasons.show_id = shows.id
            AND users_seasons.user_id = $1
        );
    `, [userId]);
    client.release();
    
    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 */
const updateWatchingByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    await client.query(` 
        UPDATE users_shows
        SET continue = NOT continue
        WHERE users_shows.user_id = $1
        AND show_id = $2
    `, [userId, showId]);
    client.release();
}

module.exports = {
    getByUserId,
    getByUserIdByContinue,
    create,
    deleteByUserIdShowId,
    getNotStartedShowsByUserId,
    getShowsByUserId,
    getShowByUserIdByShowId,
    getShowsByUserIdByTitle,
    updateWatchingByUserIdByShowId
}