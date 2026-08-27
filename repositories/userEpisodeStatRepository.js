import db from "../config/db.js";
import Stat from "../models/stat.js";
import {frenchMonth} from "../helpers/utils.js";

export default class UserEpisodeStatRepository {

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTotalTimeByUserId = async (userId) => {
        const res = await db.query(`
            SELECT SUM(COALESCE(e.length, s.duration)) AS time
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            WHERE ue.user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["time"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTimeCurrentMonthByUserId = async (userId) => {
        const res = await db.query(`
            SELECT SUM(COALESCE(e.length, s.duration)) AS time
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            WHERE ue.user_id = $1 AND ue.watched_at >= DATE_TRUNC('month', CURRENT_DATE)
        `, [userId]);
        return parseInt(res.rows[0]["time"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<Stat[]>}
     */
    getTimeHourByUserIdGroupByYear = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(YEAR FROM ue.watched_at) AS label, (SUM(COALESCE(e.length, s.duration)) / 60) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            WHERE ue.user_id = $1 AND DATE_PART('year', NOW()) - EXTRACT(YEAR FROM ue.watched_at) <= 10
            GROUP BY label
            ORDER BY label
        `, [userId]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Stat[]>}
     */
    getRecordViewingTimeMonth = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT TO_CHAR(ue.watched_at, 'MM/YYYY') AS label, SUM(COALESCE(e.length, s.duration)) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            WHERE ue.user_id = $1
            GROUP BY label
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.reverse().map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Stat[]>}
     */
    getRankingViewingTimeByShows = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT shows.title AS label, (SUM(COALESCE(e.length, shows.duration)) / 60) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows ON shows.id = e.show_id
            WHERE ue.user_id = $1
            GROUP BY label
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTotalEpisodesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total FROM users_episodes WHERE user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<Stat[]>}
     */
    getNbEpisodesByUserIdGroupByYear = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(YEAR FROM watched_at) AS label, COUNT(*) AS value
            FROM users_episodes
            WHERE user_id = $1 AND DATE_PART('year', NOW()) - EXTRACT(YEAR FROM watched_at) <= 10
            GROUP BY label
            ORDER BY label
        `, [userId]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<Stat[]>}
     */
    getNbEpisodesByUserIdGroupByMonthByCurrentYear = async (userId) => {
        const res = await db.query(`
            SELECT EXTRACT(MONTH FROM watched_at) AS num, COUNT(*) AS value
            FROM users_episodes
            WHERE user_id = $1 AND EXTRACT(YEAR FROM watched_at) = EXTRACT(YEAR FROM CURRENT_DATE)
            GROUP BY num
            ORDER BY num
        `, [userId]);
        return res.rows.map((row) => Stat.from(frenchMonth(row["num"]), row["value"]));
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns {Promise<number>}
     */
    getTotalTimeByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT SUM(COALESCE(e.length, s.duration)) AS time
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            WHERE ue.user_id = $1 AND EXTRACT(YEAR FROM ue.watched_at) = $2
        `, [userId, year]);
        return parseInt(res.rows[0]["time"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns {Promise<number>}
     */
    getTotalEpisodesByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total FROM users_episodes
            WHERE user_id = $1 AND EXTRACT(YEAR FROM watched_at) = $2
        `, [userId, year]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns {Promise<Stat|null>} the show watched the most (by minutes) that year
     */
    getTopShowByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT shows.title AS label, SUM(COALESCE(e.length, shows.duration)) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows ON shows.id = e.show_id
            WHERE ue.user_id = $1 AND EXTRACT(YEAR FROM ue.watched_at) = $2
            GROUP BY label
            ORDER BY value DESC
            LIMIT 1
        `, [userId, year]);
        return res.rowCount === 1 ? new Stat(res.rows[0]) : null;
    }

    /**
     * Per-show kinds (semicolon-separated) with minutes watched that year, for
     * the caller to split and accumulate per kind - kinds live on the show,
     * not per-episode, so they can't be summed directly in SQL.
     * @param {string} userId
     * @param {number} year
     * @returns {Promise<{kinds: string, value: number}[]>}
     */
    getKindsTimeByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT shows.kinds AS kinds, SUM(COALESCE(e.length, shows.duration)) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows ON shows.id = e.show_id
            WHERE ue.user_id = $1 AND EXTRACT(YEAR FROM ue.watched_at) = $2
            GROUP BY shows.id, kinds
        `, [userId, year]);
        return res.rows.map((row) => ({kinds: row["kinds"], value: parseInt(row["value"])}));
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns {Promise<Stat|null>} the platform used the most that year
     */
    getTopPlatformByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT p.name AS label, COUNT(*) AS value
            FROM users_episodes ue
            JOIN platforms p ON p.id = ue.platform_id
            WHERE ue.user_id = $1 AND EXTRACT(YEAR FROM ue.watched_at) = $2
            GROUP BY label
            ORDER BY value DESC
            LIMIT 1
        `, [userId, year]);
        return res.rowCount === 1 ? new Stat(res.rows[0]) : null;
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns {Promise<Stat|null>} the month watched the most (by minutes) within that year
     */
    getBestMonthByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT EXTRACT(MONTH FROM ue.watched_at) AS num, SUM(COALESCE(e.length, s.duration)) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            WHERE ue.user_id = $1 AND EXTRACT(YEAR FROM ue.watched_at) = $2
            GROUP BY num
            ORDER BY value DESC
            LIMIT 1
        `, [userId, year]);
        return res.rowCount === 1 ? Stat.from(frenchMonth(res.rows[0]["num"]), res.rows[0]["value"]) : null;
    }

    /**
     * @param {string} userId
     * @returns {Promise<string[]>} distinct days ('YYYY-MM-DD') the user watched at least one episode
     */
    getWatchedDatesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT DISTINCT TO_CHAR(watched_at, 'YYYY-MM-DD') AS date
            FROM users_episodes
            WHERE user_id = $1
        `, [userId]);
        return res.rows.map((row) => row["date"]);
    }

    /**
     * @param {string} userId
     * @returns {Promise<{date: string, value: number}[]>}
     */
    getWatchedByDay = async (userId) => {
        const res = await db.query(`
            SELECT TO_CHAR(watched_at, 'YYYY-MM-DD') AS date, COUNT(*) AS value
            FROM users_episodes
            WHERE user_id = $1
            GROUP BY date
            ORDER BY date
        `, [userId]);
        return res.rows.map((row) => ({date: row["date"], value: parseInt(row["value"])}));
    }
}
