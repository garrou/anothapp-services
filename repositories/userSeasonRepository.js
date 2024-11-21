const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @param {number} showId 
 * @param {number} number 
 * @returns {Promise<number>} id of created season
 */
const create = async (userId, showId, number) => {
    const client = await pool.connect();
    const res = await client.query(`
        INSERT INTO users_seasons (user_id, show_id, number)
        VALUES ($1, $2, $3)
        RETURNING id
    `, [userId, showId, number]);
    client.release();
    return res["rows"][0].id;
}

/**
 * @param {string} userId 
 * @param {number} showId 
 * @returns Promise<any[]>
 */
const getDistinctByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT DISTINCT ON (users_seasons.number) users_seasons.number, seasons.image, users_seasons.number, seasons.episodes
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
        SELECT us.id, us.added_at, p.id AS pid, p.name, p.logo
        FROM users_seasons us
        LEFT JOIN platforms p ON p.id = us.platform 
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
 * @returns Promise<number[]>
 */
const getTimeEpisodesByUserIdByShowId = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT SUM(seasons.episodes * shows.duration) AS time, SUM(seasons.episodes) as episodes
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
        JOIN shows ON seasons.show_id = shows.id
        WHERE user_id = $1
        AND users_seasons.show_id = $2
    `, [userId, showId]);
    client.release();
    const row = res["rows"][0];
    return [parseInt(row["time"]), parseInt(row["episodes"])];
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
        SELECT SUM(seasons.episodes * shows.duration) AS time
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
        JOIN shows ON seasons.show_id = shows.id
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
        SELECT SUM(seasons.episodes * shows.duration) AS time
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
        JOIN shows ON seasons.show_id = shows.id
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
        SELECT EXTRACT(YEAR FROM added_at) AS label, (SUM(shows.duration * episodes) / 60) AS value
        FROM users_seasons
        JOIN shows ON users_seasons.show_id = shows.id
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
        SELECT SUM(shows.duration * episodes) AS time
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
        JOIN shows ON seasons.show_id = shows.id
        WHERE users_seasons.user_id = $1 AND added_at >= DATE_TRUNC('month', CURRENT_DATE)
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
        SELECT EXTRACT(YEAR FROM added_at) AS label, SUM(episodes) AS value
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
        SELECT SUM(episodes) AS total
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
        SELECT shows.id, shows.title, shows.poster, seasons.image, seasons.episodes,
            users_seasons.number, users_seasons.added_at
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
 * @param {number} limit
 * @returns Promise<any[]>
 */
const getRankingViewingTimeByShows = async (userId, limit = 10) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT shows.title AS label, SUM(seasons.episodes * shows.duration) / 60 AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
        JOIN shows ON shows.id = seasons.show_id
        WHERE user_id = $1
        GROUP BY label
        ORDER BY value DESC   
        LIMIT $2
    `, [userId, limit]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @param {number} limit
 * @returns Promise<any> 
 */
const getRecordViewingTimeMonth = async (userId, limit = 10) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT TO_CHAR(added_at, 'MM/YYYY') as label, SUM(shows.duration * episodes) AS value 
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
        JOIN shows ON seasons.show_id = shows.id
        WHERE users_seasons.user_id = $1
        GROUP BY label
        ORDER BY value DESC 
        LIMIT $2
    `, [userId, limit]);
    client.release();
    return res["rows"].reverse();
}

/**
 * @param {string} userId
 * @param {number} year
 * @returns Promise<any[]>
 */
const getSeasonsByAddedYear = async (userId, year) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT seasons.show_id, users_seasons.number, seasons.episodes, seasons.image
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
        SELECT EXTRACT(MONTH FROM added_at) AS num, TO_CHAR(added_at, 'Mon') AS label, SUM(episodes) AS value
        FROM users_seasons
        JOIN seasons ON users_seasons.show_id = seasons.show_id
        WHERE users_seasons.number = seasons.number and EXTRACT(YEAR FROM added_at) = EXTRACT(YEAR FROM current_date)
        AND users_seasons.user_id = $1
        GROUP BY num, label
        ORDER BY num
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @param {number} limit
 * @returns Promise<any[]>
 */
const getPlatformsByUserId = async (userId, limit = 10) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT name as label, COUNT(*) AS value
        FROM users_seasons us
        JOIN platforms p ON p.id = us.platform
        WHERE us.user_id = $1
        GROUP BY name
        ORDER BY value DESC
        LIMIT $2
    `, [userId, limit]);
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
    getPlatformsByUserId,
    getRankingViewingTimeByShows,
    getRecordViewingTimeMonth,
    getSeasonsByAddedYear,
    getTimeCurrentMonthByUserId,
    getTimeEpisodesByUserIdByShowId,
    getTimeHourByUserIdGroupByYear,
    getTotalEpisodesByUserId,
    getTotalSeasonsByUserId,
    getTotalTimeByUserId,
    getViewedByMonthAgo,
    getViewingTimeByUserIdByShowIdByNumber
}