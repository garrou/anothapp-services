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
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, us.favorite, us.added_at, us.continue, s.country
        FROM shows s
        JOIN users_shows us ON s.id = us.show_id
        WHERE us.user_id = $1
        ORDER BY us.added_at DESC
        LIMIT $2
    `, [userId, limit]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns Promise<any>
 */
const getShowByUserIdByShowId = async (userId, id) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, us.favorite, us.added_at, us.continue, s.country
        FROM shows s
        JOIN users_shows us ON s.id = us.show_id
        WHERE us.user_id = $1 AND us.show_id = $2
        LIMIT 1
    `, [userId, id]);
    client.release();
    return res["rows"][0];
}

/**
 * @param {string} userId 
 * @param {string} title
 * @returns Promise<any[]>
 */
const getShowsByUserIdByTitle = async (userId, title) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, us.favorite, us.added_at, us.continue, s.country
        FROM users_shows us
        JOIN shows s ON s.id = us.show_id
        WHERE user_id = $1 AND UPPER(s.title) LIKE UPPER($2)
        ORDER BY us.added_at DESC
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
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, us.favorite, us.added_at, us.continue, s.country
        FROM shows s
        JOIN users_shows us ON us.show_id = s.id
        WHERE us.user_id = $1
        AND NOT EXISTS (
            SELECT *
            FROM users_seasons
            WHERE users_seasons.show_id = s.id AND users_seasons.user_id = $1
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
    const res = await client.query(` 
        UPDATE users_shows
        SET continue = NOT continue
        WHERE user_id = $1
        AND show_id = $2
        RETURNING continue
    `, [userId, showId]);
    client.release();
    return res["rows"][0]["continue"];
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @return Promise<boolean>
 */
const updateFavoriteByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(` 
        UPDATE users_shows
        SET favorite = NOT favorite
        WHERE user_id = $1
        AND show_id = $2
        RETURNING favorite
    `, [userId, showId]);
    client.release();
    return res["rows"][0]["favorite"];
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getShowsToResumeByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, us.favorite, us.added_at, us.continue, s.country
        FROM shows s
        JOIN users_shows us ON us.show_id = s.id
        WHERE us.user_id = $1 AND us.continue = FALSE AND s.seasons - (
	        SELECT COUNT(distinct users_seasons.number)
	        FROM shows
	        JOIN users_seasons ON s.id = users_seasons.show_id 
	        WHERE users_seasons.user_id = $1 and s.id = shows.id
        ) > 0
        ORDER BY s.title
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
        SELECT s.kinds
        FROM shows s
        JOIN users_shows us ON us.show_id = s.id
        WHERE us.user_id = $1 
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @param {number} limit
 * @returns Promise<any[]>
 */
const getCountriesByUserId = async (userId, limit = 10) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.country AS label, COUNT(*) AS value
        FROM shows s
        JOIN users_shows us ON us.show_id = s.id
        WHERE us.user_id = $1
        GROUP BY s.country
        ORDER BY value DESC
        LIMIT $2
    `, [userId, limit]);
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
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, us.favorite, us.added_at, us.continue, s.country
        FROM shows s
        JOIN users_shows us ON us.show_id = s.id
        WHERE us.user_id = $1 AND kinds LIKE $2
    `, [userId, `%${kind}%`]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @return Promise<any[]>
 */
const getFavoritesByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, us.favorite, us.added_at, us.continue, s.country
        FROM users_shows us
        JOIN shows s ON s.id = us.show_id
        WHERE us.user_id = $1 AND favorite = TRUE
        ORDER BY s.title
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getShowsToContinueByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, s.seasons - (
	        SELECT COUNT(distinct users_seasons.number)
	        FROM shows
	        JOIN users_seasons ON s.id = users_seasons.show_id 
	        WHERE users_seasons.user_id = $1 and s.id = shows.id
        ) as missing, us.added_at, us.continue, s.country
        FROM shows s
        JOIN users_shows us ON s.id = us.show_id
        WHERE us.user_id = $1 AND us.continue = TRUE
        ORDER BY s.title
    `, [userId]);
    client.release();
    return res["rows"].filter((row) => row.missing > 0);
}

const getSharedShowsWithFriend = async (userId, friendId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT s.id, s.title, s.poster, s.kinds, s.duration, s.country
        FROM shows s
        WHERE id in (
	        SELECT show_id
            FROM users_shows
            WHERE user_id = $1
            INTERSECT
            SELECT show_id
            FROM users_shows
            WHERE user_id = $2
        )
        ORDER BY s.title
    `, [userId, friendId]);
    client.release();
    return res["rows"];
}

module.exports = {
    checkShowExistsByUserIdByShowId,
    create,
    deleteByUserIdShowId,
    getCountriesByUserId,
    getFavoritesByUserId,
    getKindsByUserId,
    getNotStartedShowsByUserId,
    getSharedShowsWithFriend,
    getShowByUserIdByShowId,
    getShowsByUserId,
    getShowsByUserIdByKind,
    getShowsByUserIdByTitle,
    getShowsToContinueByUserId,
    getTotalShowsByUserId,
    getShowsToResumeByUserId,
    updateFavoriteByUserIdByShowId,
    updateWatchingByUserIdByShowId
}