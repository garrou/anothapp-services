const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns Promise<boolean>
 */
const checkShowExistsByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT COUNT(*) AS total
        FROM users_shows
        WHERE user_id = $1 AND show_id = $2
    `, [userId, showId]);
    client.release();
    return parseInt(res["rows"][0]["total"]) === 1;
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
 * @param {number} limit
 * @returns Promise<any[]>
 */
const getShowsByUserId = async (userId, limit) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, title, poster
        FROM users_shows
        JOIN shows ON id = show_id
        WHERE user_id = $1
        ORDER BY users_shows.added_at DESC
        LIMIT $2
    `, [userId, limit]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @param {string} title
 * @returns Promise<any[]>
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
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<number>
 */
const getTotalShowsByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT COUNT(*) AS total
        FROM users_shows
        WHERE user_id = $1
    `, [userId]);
    client.release();
    return parseInt(res["rows"][0]["total"] ?? 0);
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
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
    return res["rows"];
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

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getShowsToResumeByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, title, poster
        FROM shows
        JOIN users_shows ON users_shows.show_id = shows.id
        WHERE users_shows.user_id = $1 
        AND users_shows.continue = FALSE
        ORDER BY title
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getKindsByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT kinds
        FROM shows
        JOIN users_shows ON users_shows.show_id = shows.id
        WHERE users_shows.user_id = $1 
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @param {string} kind 
 * @returns Promise<any[]>
 */
const getShowsByUserIdByKind = async (userId, kind) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, title, poster
        FROM shows
        JOIN users_shows ON users_shows.show_id = shows.id
        WHERE users_shows.user_id = $1 
        AND kinds LIKE $2
    `, [userId, `%${kind}%`]);
    client.release();
    return res["rows"];
}

module.exports = {
    checkShowExistsByUserIdByShowId,
    create,
    deleteByUserIdShowId,
    getKindsByUserId,
    getNotStartedShowsByUserId,
    getShowsByUserId,
    getShowsByUserIdByKind,
    getShowsByUserIdByTitle,
    getTotalShowsByUserId,
    getShowsToResumeByUserId,
    updateWatchingByUserIdByShowId
}