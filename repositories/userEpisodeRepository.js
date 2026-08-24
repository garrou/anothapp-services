import db from "../config/db.js";
import UserEpisode from "../models/userEpisode.js";

export default class UserEpisodeRepository {

    /**
     * @param {string} userId
     * @param {number} userSeasonId
     * @param {number} episodeId
     * @param {string} watchedAt
     * @returns {Promise<boolean>}
     */
    create = async (userId, userSeasonId, episodeId, watchedAt) => {
        const res = await db.query(`
            INSERT INTO users_episodes (user_id, users_seasons_id, episode_id, watched_at)
            VALUES ($1, $2, $3, $4)
        `, [userId, userSeasonId, episodeId, watchedAt]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} userSeasonId
     * @param {number} episodeId
     * @param {string} watchedAt
     * @returns {Promise<void>}
     */
    createIfMissing = async (userId, userSeasonId, episodeId, watchedAt) => {
        await db.query(`
            INSERT INTO users_episodes (user_id, users_seasons_id, episode_id, watched_at)
            SELECT $1, $2, $3, $4
            WHERE NOT EXISTS (
                SELECT 1 FROM users_episodes WHERE users_seasons_id = $2 AND episode_id = $3
            )
        `, [userId, userSeasonId, episodeId, watchedAt]);
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
