const pool = require('../helpers/db');

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

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns Promise<any[]>
 */
const getDistinctByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT DISTINCT ON (users_seasons.number) users_seasons.number, seasons.show_id, seasons.image, users_seasons.number, seasons.episode
        FROM users_seasons
        JOIN seasons ON seasons.show_id = users_seasons.show_id 
        AND seasons.number = users_seasons.number
        WHERE users_seasons.user_id = $1 AND users_seasons.show_id = $2
        ORDER BY users_seasons.number
    `, [userId, showId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @param {number} number 
 * @returns Promise<any[]>
 */
const getInfosByUserIdByShowId = async (userId, showId, number) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, added_at
        FROM users_seasons
        WHERE user_id = $1
        AND show_id = $2
        AND number = $3
        ORDER BY added_at
    `, [userId, showId, number]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns Promise<number>
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
    return parseInt(res["rows"][0]["time"]);
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @param {number} number
 * @returns Promise<number>
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
    return parseInt(res["rows"][0]["time"]);
}

/**
 * @param {string} userId 
 * @returns Promise<number>
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
    return parseInt(res["rows"][0]["time"] ?? 0);
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getNbSeasonsByUserIdGroupByYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(YEAR FROM added_at) AS label, COUNT(*) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        AND DATE_PART('year', NOW()) - EXTRACT(YEAR FROM added_at) <= 10
        WHERE users_seasons.user_id = $1
        GROUP BY label
        ORDER BY label
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getTimeHourByUserIdGroupByYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(YEAR FROM added_at) AS label, (SUM(ep_duration * episode) / 60) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        AND DATE_PART('year', NOW()) - EXTRACT(YEAR FROM added_at) <= 10
        WHERE users_seasons.user_id = $1
        GROUP BY label
        ORDER BY label
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<QueryResult>
 */
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
    return parseInt(res["rows"][0]["time"] ?? 0);
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
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
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getNbEpisodesByUserIdGroupByYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(YEAR FROM added_at) AS label, SUM(episode) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        WHERE users_seasons.number = seasons.number
        AND users_seasons.user_id = $1
        AND DATE_PART('year', NOW()) - EXTRACT(YEAR FROM added_at) <= 10
        GROUP BY label
        ORDER BY label
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<number>
 */
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
    return parseInt(res["rows"][0]["total"] ?? 0);
}

/**
 * @param {string} userId
 * @return Promise<number> 
 */
const getTotalSeasonsByUserId = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT COUNT(*) AS total
        FROM users_seasons
        WHERE user_id = $1 
    `, [userId]);
    client.release();
    return parseInt(res["rows"][0]["total"] ?? 0);
}

/**
 * @param {string} userId 
 * @param {number} month
 * @returns Promise<any[]>
 */
const getViewedByMonthAgo = async (userId, month) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT shows.id, shows.title, seasons.image, shows.poster, users_seasons.number
        FROM users_seasons
        JOIN seasons ON seasons.show_id = users_seasons.show_id
        JOIN shows ON shows.id = seasons.show_id
        AND seasons.number = users_seasons.number
        AND added_at >= DATE_TRUNC('month', CURRENT_DATE) - $2 * INTERVAL '1 month'
        WHERE users_seasons.user_id = $1
        ORDER BY added_at DESC
    `, [userId, month]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId
 * @returns Promise<any[]>
 */
const getRankingViewingTimeByShows = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT shows.title AS label, SUM(seasons.episode * seasons.ep_duration) / 60 AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        JOIN shows ON shows.id = seasons.show_id
        WHERE user_id = $1
        GROUP BY label
        ORDER BY value DESC   
        LIMIT 10
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<any> 
 */
const getRecordViewingTimeMonth = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT TO_CHAR(added_at, 'MM/YYYY') as date, SUM(ep_duration * episode) AS time 
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        AND users_seasons.number = seasons.number
        WHERE users_seasons.user_id = $1
        GROUP BY date
        ORDER BY time DESC 
        LIMIT 1
    `, [userId]);
    client.release();
    return res["rows"][0];
}

/**
 * @param {string} userId
 * @param {number} year
 * @returns Promise<any[]>
 */
const getSeasonsByAddedYear = async (userId, year) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT seasons.show_id, users_seasons.number, seasons.episode, seasons.image
        FROM users_seasons
        JOIN seasons ON seasons.show_id = users_seasons.show_id
        AND seasons.number = users_seasons.number
        WHERE users_seasons.user_id = $1 and EXTRACT(year FROM added_at) = $2
        ORDER BY added_at, number
    `, [userId, year]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId
 * @returns Promise<any[]>
 */
const getNbSeasonsByUserIdGroupByMonthByCurrentYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(MONTH FROM added_at) AS num, TO_CHAR(added_at, 'Mon') AS label, COUNT(*) AS value
        FROM users_seasons
        WHERE users_seasons.user_id = $1 AND EXTRACT(YEAR FROM added_at) = EXTRACT(YEAR from CURRENT_DATE)
        GROUP BY num, label
        ORDER BY num
    `, [userId]);
    client.release();
    return res["rows"];
}

const getNbEpisodesByUserIdGroupByMonthByCurrentYear = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT EXTRACT(MONTH FROM added_at) AS num, TO_CHAR(added_at, 'Mon') AS label, SUM(episode) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        WHERE users_seasons.number = seasons.number and extract(year from added_at) = extract(year from current_date)
        AND users_seasons.user_id = $1
        GROUP BY num, label
        ORDER BY label
    `, [userId]);
    client.release();
    return res["rows"];
}

module.exports = {
    create,
    getDistinctByUserIdByShowId,
    getNbEpisodesByUserIdGroupByYear,
    getNbEpisodesByUserIdGroupByMonthByCurrentYear,
    getNbSeasonsByUserIdGroupByMonth,
    getNbSeasonsByUserIdGroupByMonthByCurrentYear,
    getNbSeasonsByUserIdGroupByYear,
    getInfosByUserIdByShowId,
    getRankingViewingTimeByShows,
    getRecordViewingTimeMonth,
    getSeasonsByAddedYear,
    getTimeCurrentMonthByUserId,
    getTimeHourByUserIdGroupByYear,
    getTotalEpisodesByUserId,
    getTotalSeasonsByUserId,
    getTotalTimeByUserId,
    getViewedByMonthAgo,
    getViewingTimeByUserIdByShowId,
    getViewingTimeByUserIdByShowIdByNumber
}