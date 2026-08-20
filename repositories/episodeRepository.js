import db from "../config/db.js";
import Episode from "../models/episode.js";
import {UserEpisode} from "../models/userEpisode.js";

export default class EpisodeRepository {

    /**
     * @param {number} showId
     * @param {number} season
     * @returns {Promise<boolean>}
     */
    hasEpisodesByShowIdBySeason = async (showId, season) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM episodes
            WHERE show_id = $1 AND season = $2
        `, [showId, season]);
        return parseInt(res.rows[0]["total"]) > 0;
    }

    /**
     * @param {number} id
     * @param {string} title
     * @param {number} number
     * @param {number} season
     * @param {string} code
     * @param {number} global
     * @param {number} length
     * @param {string} date
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    createEpisode = async (id, title, number, season, code, global, length, date, showId) => {
        const res = await db.query(`
            INSERT INTO episodes (id, title, number, season, code, global, length, date, show_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        `, [id, title, number, season, code, global, length, date, showId]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} id
     * @returns {Promise<Episode|null>}
     */
    getEpisodeById = async (id) => {
        const res = await db.query(`
            SELECT *
            FROM episodes
            WHERE id = $1
        `, [id]);
        return res.rowCount === 1 ? new Episode(res.rows[0]) : null;
    }

    /**
     * A watched episode can have several users_episodes rows (rewatches, same
     * as users_seasons), so the join is deduped per episode, keeping the most
     * recent watch.
     * @param {string} userId
     * @param {number} showId
     * @param {number} season
     * @returns {Promise<UserEpisode[]>}
     */
    getEpisodesWithWatchedStatus = async (userId, showId, season) => {
        const res = await db.query(`
            SELECT * FROM (
                SELECT DISTINCT ON (e.id) e.id, e.title, e.number, e.season, e.code, e.global, e.length, e.date,
                       ue.added_at
                FROM episodes e
                LEFT JOIN users_episodes ue ON ue.episode_id = e.id AND ue.user_id = $1
                WHERE e.show_id = $2 AND e.season = $3
                ORDER BY e.id, ue.added_at DESC NULLS LAST
            ) sub
            ORDER BY number
        `, [userId, showId, season]);
        return res.rows.map((row) => new UserEpisode(row));
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    deleteEpisodeById = async (userId, id) => {
        const res = await db.query(`
            DELETE FROM users_episodes
            WHERE id = $1 AND user_id = $2
        `, [id, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @param {number} platform
     * @param {string} viewedAt
     * @returns {Promise<boolean>}
     */
    updateEpisode = async (userId, id, platform, viewedAt) => {
        const res = await db.query(`
            UPDATE users_episodes
            SET platform_id = $1, added_at = $4
            WHERE id = $2 AND user_id = $3
        `, [platform, id, userId, viewedAt]);
        return res.rowCount === 1;
    }
}
