import db from "../config/db.js";
import Stat from "../models/stat.js";

export default class UserEpisodeStatRepository {

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getTotalTimeByUserId = async (userId) => {
        const res = await db.query(`
            SELECT SUM(e.length) AS time
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
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
            SELECT SUM(e.length) AS time
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
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
            SELECT EXTRACT(YEAR FROM ue.watched_at) AS label, (SUM(e.length) / 60) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
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
            SELECT TO_CHAR(ue.watched_at, 'MM/YYYY') AS label, SUM(e.length) AS value
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
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
            SELECT shows.title AS label, (SUM(e.length) / 60) AS value
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
            SELECT EXTRACT(MONTH FROM watched_at) AS num, TO_CHAR(watched_at, 'Mon') AS label, COUNT(*) AS value
            FROM users_episodes
            WHERE user_id = $1 AND EXTRACT(YEAR FROM watched_at) = EXTRACT(YEAR FROM CURRENT_DATE)
            GROUP BY num, label
            ORDER BY num
        `, [userId]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * Daily watch counts, for a GitHub-style contribution heatmap.
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
