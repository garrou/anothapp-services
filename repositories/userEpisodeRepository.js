import db from "../config/db.js";
import UserEpisode from "../models/userEpisode.js";
import EpisodeTimeline from "../models/episodeTimeline.js";

export default class UserEpisodeRepository {

    /**
     * @param {string} userId
     * @param {number} month
     * @returns {Promise<EpisodeTimeline[]>}
     */
    getViewedByMonthAgo = async (userId, month) => {
        const res = await db.query(`
            SELECT s.id, s.title, s.poster, ue.watched_at, ue.platform_id,
                   e.id AS episode_id, e.title AS episode_title, e.code AS episode_code,
                   e.number AS episode_number, e.global AS episode_global
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            WHERE ue.user_id = $1 AND ue.watched_at >= DATE_TRUNC('month', CURRENT_DATE) - $2 * INTERVAL '1 month'
            ORDER BY ue.watched_at DESC
        `, [userId, month]);
        return res.rows.map((row) => new EpisodeTimeline(row));
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} seasonNumber
     * @returns {Promise<number>}
     */
    getWatchedTimeByShowIdBySeasonNumber = async (userId, showId, seasonNumber) => {
        const res = await db.query(`
            SELECT SUM(COALESCE(e.length, s.duration)) AS time
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            JOIN users_seasons us ON us.id = ue.users_seasons_id
            WHERE ue.user_id = $1 AND us.show_id = $2 AND us.number = $3
        `, [userId, showId, seasonNumber]);
        return parseInt(res.rows[0]["time"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<[number, number, number]>} watched time, count of watched episodes, count of distinct watched episodes
     */
    getWatchedTimeAndCountByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT SUM(COALESCE(e.length, s.duration)) AS time, COUNT(*) AS episodes,
                   COUNT(DISTINCT ue.episode_id) AS distinct_episodes
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            JOIN shows s ON s.id = e.show_id
            JOIN users_seasons us ON us.id = ue.users_seasons_id
            WHERE ue.user_id = $1 AND us.show_id = $2
        `, [userId, showId]);
        const row = res.rows[0];
        return [parseInt(row["time"] ?? 0), parseInt(row["episodes"] ?? 0), parseInt(row["distinct_episodes"] ?? 0)];
    }

    /**
     * @param {string} userId
     * @param {number} userSeasonId
     * @param {number} episodeId
     * @param {string} watchedAt
     * @param {number} platformId
     * @returns {Promise<boolean>}
     */
    create = async (userId, userSeasonId, episodeId, watchedAt, platformId) => {
        const res = await db.query(`
            INSERT INTO users_episodes (user_id, users_seasons_id, episode_id, watched_at, platform_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, userSeasonId, episodeId, watchedAt, platformId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} userSeasonId
     * @param {number} episodeId
     * @param {string} watchedAt
     * @param {number} platformId
     * @returns {Promise<void>}
     */
    createIfMissing = async (userId, userSeasonId, episodeId, watchedAt, platformId) => {
        await db.query(`
            INSERT INTO users_episodes (user_id, users_seasons_id, episode_id, watched_at, platform_id)
            SELECT $1, $2, $3, $4, $5
            WHERE NOT EXISTS (
                SELECT 1 FROM users_episodes WHERE users_seasons_id = $2 AND episode_id = $3
            )
        `, [userId, userSeasonId, episodeId, watchedAt, platformId]);
    }

    /**
     * @param {number} userSeasonId
     * @param {number} episodeId
     * @returns {Promise<boolean>}
     */
    existsForViewing = async (userSeasonId, episodeId) => {
        const res = await db.query(`
            SELECT EXISTS(
                SELECT 1 FROM users_episodes WHERE users_seasons_id = $1 AND episode_id = $2
            ) AS exists
        `, [userSeasonId, episodeId]);
        return res.rows[0]["exists"];
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @param {string} watchedAt
     * @returns {Promise<boolean>}
     */
    updateWatchedAt = async (userId, id, watchedAt) => {
        const res = await db.query(`
            UPDATE users_episodes SET watched_at = $1
            WHERE id = $2 AND user_id = $3
        `, [watchedAt, id, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    deleteById = async (userId, id) => {
        const res = await db.query(`
            DELETE FROM users_episodes WHERE id = $1 AND user_id = $2
        `, [id, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @returns {Promise<{userSeasonId: number, episode: UserEpisode}[]>}
     */
    getAllByUserId = async (userId) => {
        const res = await db.query(`
            SELECT ue.id, ue.users_seasons_id, e.id AS episode_id, e.title, e.code, e.number, e.global, e.date, ue.watched_at
            FROM users_episodes ue
            JOIN episodes e ON ue.episode_id = e.id
            WHERE ue.user_id = $1
            ORDER BY ue.users_seasons_id, e.number
        `, [userId]);
        return res.rows.map((row) => ({userSeasonId: row["users_seasons_id"], episode: new UserEpisode(row)}));
    }

    /**
     * @param {number} userSeasonId
     * @param {number} showId
     * @param {number} seasonNumber
     * @returns {Promise<UserEpisode[]>}
     */
    getByUserSeasonId = async (userSeasonId, showId, seasonNumber) => {
        const res = await db.query(`
            SELECT ue.id, e.id AS episode_id, e.title, e.code, e.number, e.global, e.date, ue.watched_at
            FROM episodes e
            LEFT JOIN users_episodes ue ON ue.episode_id = e.id AND ue.users_seasons_id = $1
            WHERE e.show_id = $2 AND e.season_number = $3
            ORDER BY e.number
        `, [userSeasonId, showId, seasonNumber]);
        return res.rows.map((row) => new UserEpisode(row));
    }
}
