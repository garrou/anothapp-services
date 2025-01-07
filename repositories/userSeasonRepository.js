import db from "../config/db.js";

export default class UserSeasonRepository {

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<boolean>}
     */
    create = async (userId, showId, number) => {
        const res = await db.query(`
            INSERT INTO users_seasons (user_id, show_id, number)
            VALUES ($1, $2, $3)
        `, [userId, showId, number]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<any[]>}
     */
    getDistinctByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT DISTINCT
            ON (users_seasons.number) users_seasons.number, seasons.image, users_seasons.number, seasons.episodes
            FROM users_seasons
            JOIN seasons
            ON seasons.show_id = users_seasons.show_id AND seasons.number = users_seasons.number
            WHERE users_seasons.user_id = $1 AND users_seasons.show_id = $2
            ORDER BY users_seasons.number
        `, [userId, showId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<any[]>}
     */
    getInfosByUserIdByShowId = async (userId, showId, number) => {
        const res = await db.query(`
            SELECT us.id, us.added_at, p.id AS pid, p.name, p.logo
            FROM users_seasons us
            LEFT JOIN platforms p ON p.id = us.platform_id
            WHERE user_id = $1 AND show_id = $2 AND number = $3
            ORDER BY added_at
        `, [userId, showId, number]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<number[]>}
     */
    getTimeEpisodesByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT SUM(seasons.episodes * shows.duration) AS time, SUM(seasons.episodes) as episodes
            FROM users_seasons
            JOIN seasons
            ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            JOIN shows ON seasons.show_id = shows.id
            WHERE user_id = $1 AND users_seasons.show_id = $2
        `, [userId, showId]);
        const row = res.rows[0];
        return [parseInt(row["time"]), parseInt(row["episodes"])];
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @returns {Promise<number>}
     */
    getViewingTimeByUserIdByShowIdByNumber = async (userId, showId, number) => {
        const res = await db.query(`
            SELECT SUM(seasons.episodes * shows.duration) AS time
            FROM users_seasons
            JOIN seasons
            ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            JOIN shows ON seasons.show_id = shows.id
            WHERE users_seasons.user_id = $1 AND users_seasons.show_id = $2 AND users_seasons.number = $3
        `, [userId, showId, number]);
        return parseInt(res.rows[0]["time"]);
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTotalTimeByUserId = async (userId) => {
        const res = await db.query(`
            SELECT SUM(seasons.episodes * shows.duration) AS time
            FROM users_seasons
            JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            JOIN shows ON seasons.show_id = shows.id
            WHERE user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["time"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    getNbSeasonsByUserIdGroupByYear = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(YEAR FROM added_at) AS label, COUNT(*) AS value
            FROM users_seasons
            JOIN seasons
            ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number AND DATE_PART('year', NOW()) - EXTRACT (YEAR FROM added_at) <= 10
            WHERE users_seasons.user_id = $1
            GROUP BY label
            ORDER BY label
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    getTimeHourByUserIdGroupByYear = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(YEAR FROM added_at) AS label, (SUM(shows.duration * episodes) / 60) AS value
            FROM users_seasons
            JOIN shows ON users_seasons.show_id = shows.id
            JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number AND DATE_PART('year', NOW()) - EXTRACT (YEAR FROM added_at) <= 10
            WHERE users_seasons.user_id = $1
            GROUP BY label
            ORDER BY label
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTimeCurrentMonthByUserId = async (userId) => {
        const res = await db.query(`
            SELECT SUM(shows.duration * episodes) AS time
            FROM users_seasons
            JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            JOIN shows ON seasons.show_id = shows.id
            WHERE users_seasons.user_id = $1 AND added_at >= DATE_TRUNC('month', CURRENT_DATE)
        `, [userId]);
        return parseInt(res.rows[0]["time"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    getNbSeasonsByUserIdGroupByMonth = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(MONTH FROM added_at) AS num, TO_CHAR(added_at, 'Mon') AS label, COUNT(*) AS value
            FROM users_seasons
            WHERE users_seasons.user_id = $1
            GROUP BY num, label
            ORDER BY num
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    getNbEpisodesByUserIdGroupByYear = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(YEAR FROM added_at) AS label, SUM(episodes) AS value
            FROM users_seasons
            JOIN seasons
            ON users_seasons.show_id = seasons.show_id
            WHERE users_seasons.number = seasons.number AND users_seasons.user_id = $1 AND DATE_PART('year', NOW()) - EXTRACT (YEAR FROM added_at) <= 10
            GROUP BY label
            ORDER BY label
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTotalEpisodesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT SUM(episodes) AS total
            FROM users_seasons
            JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            WHERE user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @return Promise<number>
     */
    getTotalSeasonsByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_seasons
            WHERE user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} month
     * @returns {Promise<any[]>}
     */
    getViewedByMonthAgo = async (userId, month) => {
        const res = await db.query(`
            SELECT s.id, s.title, s.poster, se.image, se.episodes, us.number, us.added_at
            FROM users_seasons us
            JOIN seasons se ON se.show_id = us.show_id
            JOIN shows s ON s.id = se.show_id AND se.number = us.number AND added_at >= DATE_TRUNC('month', CURRENT_DATE) - $2 * INTERVAL '1 month'
            WHERE us.user_id = $1
            ORDER BY added_at DESC
        `, [userId, month]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns Promise<any[]>
     */
    getRankingViewingTimeByShows = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT shows.title AS label, SUM(seasons.episodes * shows.duration) / 60 AS value
            FROM users_seasons
            JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            JOIN shows ON shows.id = seasons.show_id
            WHERE user_id = $1
            GROUP BY label
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns Promise<any>
     */
    getRecordViewingTimeMonth = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT TO_CHAR(added_at, 'MM/YYYY') as label, SUM(shows.duration * episodes) AS value
            FROM users_seasons
            JOIN seasons ON users_seasons.show_id = seasons.show_id AND users_seasons.number = seasons.number
            JOIN shows ON seasons.show_id = shows.id
            WHERE users_seasons.user_id = $1
            GROUP BY label
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.reverse();
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns Promise<any[]>
     */
    getSeasonsByAddedYear = async (userId, year) => {
        const res = await db.query(`
            SELECT seasons.show_id, users_seasons.number, seasons.episodes, seasons.image
            FROM users_seasons
            JOIN seasons ON seasons.show_id = users_seasons.show_id AND seasons.number = users_seasons.number
            WHERE users_seasons.user_id = $1 AND EXTRACT(year FROM added_at) = $2
            ORDER BY added_at, number
        `, [userId, year]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns Promise<any[]>
     */
    getNbSeasonsByUserIdGroupByMonthByCurrentYear = async (userId)  => {
        const res = await db.query(`
            SELECT EXTRACT(MONTH FROM added_at) AS num, TO_CHAR(added_at, 'Mon') AS label, COUNT(*) AS value
            FROM users_seasons
            WHERE users_seasons.user_id = $1 AND EXTRACT (YEAR FROM added_at) = EXTRACT (YEAR FROM CURRENT_DATE)
            GROUP BY num, label
            ORDER BY num
        `, [userId]);
        return res.rows;
    }

    getNbEpisodesByUserIdGroupByMonthByCurrentYear = async (userId)  => {
        const res = await db.query(`
            SELECT EXTRACT(MONTH FROM added_at) AS num, TO_CHAR(added_at, 'Mon') AS label, SUM(episodes) AS value
            FROM users_seasons
            JOIN seasons ON users_seasons.show_id = seasons.show_id
            WHERE users_seasons.number = seasons.number AND EXTRACT (YEAR FROM added_at) = EXTRACT (YEAR FROM current_date) AND users_seasons.user_id = $1
            GROUP BY num, label
            ORDER BY num
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns Promise<any[]>
     */
    getPlatformsByUserId = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT name as label, COUNT(*) AS value
            FROM users_seasons us
            JOIN platforms p ON p.id = us.platform_id
            WHERE us.user_id = $1
            GROUP BY name
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows;
    }
}