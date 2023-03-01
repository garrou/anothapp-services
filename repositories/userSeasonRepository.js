const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns QueryResult
 */
const getByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT *
        FROM users_seasons
        JOIN seasons ON seasons.show_id = users_seasons.show_id
        AND seasons.number = users_seasons.number
        WHERE users_seasons.user_id = $1 AND users_seasons.show_id = $2
    `, [userId, showId]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @param {number} number 
 */
const create = async (userId, showId, number) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO users_seasons (user_id, show_id, number)
        VALUES ($1, $2, $3)
    `, [userId, showId, number]);
    client.release();
}

const getDistinctByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT DISTINCT ON (users_seasons.number) users_seasons.number, * 
        FROM users_seasons
        JOIN seasons ON seasons.show_id = users_seasons.show_id 
        AND seasons.number = users_seasons.number
        WHERE users_seasons.user_id = $1 AND users_seasons.show_id = $2
        ORDER BY users_seasons.number
    `, [userId, showId]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @param {number} number 
 * @returns 
 */
const getInfosByUserIdByShowId = async (userId, showId, number) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, added_at
        FROM users_seasons
        WHERE user_id = $1
        AND show_id = $2
        AND number = $3
    `, [userId, showId, number]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns QueryResult
 */
const getViewingTimeByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT SUM(seasons.episode * seasons.ep_duration) AS time
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE user_id = $1
        AND users_seasons.show_id = $2
    `, [userId, showId]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @param {number} number
 * @returns QueryResult
 */
const getViewingTimeByUserIdByShowIdByNumber = async (userId, showId, number) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT SUM(seasons.episode * seasons.ep_duration) AS time
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE users_seasons.user_id = $1
        AND users_seasons.show_id = $2
        AND users_seasons.number = $3
    `, [userId, showId, number]);
    client.release();

    return res;
}

/**
 * @param {string} userId 
 * @returns QueryResult
 */
const getTotalTimeByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT SUM(seasons.episode * seasons.ep_duration) AS time
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE user_id = $1
    `, [userId]);
    client.release();

    return res;
}

const getNbSeasonsByUserIdGroupByYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(YEAR FROM added_at) AS label, COUNT(*) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE users_seasons.user_id = $1
        GROUP BY label
        ORDER BY label
    `, [userId]);
    client.release();

    return res;
}

const getTimeHourByUserIdGroupByYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(YEAR FROM added_at) AS label, (SUM(ep_duration * episode) / 60) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE users_seasons.user_id = $1
        GROUP BY label
        ORDER BY label
    `, [userId]);
    client.release();

    return res;
}

const getTimeCurrentMonthByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT SUM(ep_duration * episode) AS time
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE users_seasons.user_id = $1
        AND added_at >= DATE_TRUNC('month', CURRENT_DATE)
    `, [userId]);
    client.release();

    return res;
}

const getNbSeasonsByUserIdGroupByMonth = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(MONTH FROM added_at) AS num, TO_CHAR(added_at, 'Mon') AS label, COUNT(*) AS value
        FROM users_seasons
        WHERE users_seasons.user_id = $1
        GROUP BY num, label
        ORDER BY num
    `, [userId]);
    client.release();

    return res;
}


const getNbEpisodesByUserIdGroupByYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(YEAR FROM added_at) AS label, SUM(episode) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        WHERE users_seasons.number = seasons.number
        AND users_seasons.user_id = $1
        GROUP BY label
        ORDER BY label
    `, [userId]);
    client.release();

    return res;
}

const getTotalEpisodesByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT SUM(episode) AS total
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE user_id = $1 
    `, [userId]);
    client.release();

    return res;
}

const getViewedCurrentMonth = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT shows.id, shows.title, seasons.image, shows.poster, users_seasons.number
        FROM users_seasons
        JOIN seasons ON seasons.show_id = users_seasons.show_id
        JOIN shows ON shows.id = seasons.show_id
        AND seasons.number = users_seasons.number
        AND added_at >= DATE_TRUNC('month', CURRENT_DATE)
        WHERE users_seasons.user_id = $1
    `, [userId]);
    client.release();

    return res;
}

module.exports = {
    create,
    getByUserIdByShowId,
    getDistinctByUserIdByShowId,
    getNbEpisodesByUserIdGroupByYear,
    getNbSeasonsByUserIdGroupByMonth,
    getNbSeasonsByUserIdGroupByYear,
    getInfosByUserIdByShowId,
    getTimeCurrentMonthByUserId,
    getTimeHourByUserIdGroupByYear,
    getTotalEpisodesByUserId,
    getTotalTimeByUserId,
    getViewedCurrentMonth,
    getViewingTimeByUserIdByShowId,
    getViewingTimeByUserIdByShowIdByNumber
}