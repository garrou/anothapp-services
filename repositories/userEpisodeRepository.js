import db from "../config/db.js";
import UserEpisode from "../models/userEpisode.js";

export default class UserEpisodeRepository {

    /**
     * Creates one "not watched yet" placeholder row per episode, skipping episodes that
     * already have a row (watched or not) for this user. Used when a season is added
     * while episode tracking is enabled.
     * @param {string} userId
     * @param {number[]} episodeIds
     * @returns {Promise<void>}
     */
    createPlaceholders = async (userId, episodeIds) => {
        for (const episodeId of episodeIds) {
            await db.query(`
                INSERT INTO users_episodes (user_id, episode_id, watched_at)
                SELECT $1, $2, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM users_episodes WHERE user_id = $1 AND episode_id = $2
                )
            `, [userId, episodeId]);
        }
    }

    /**
     * Backfills history for one episode: tops up its watched rows so it has at least
     * `watchedDates.length` of them (a season rewatched N times means every one of its
     * episodes was watched N times too), reusing whatever rows already exist and only
     * inserting the missing ones, dated with the remaining `watchedDates`. Idempotent -
     * re-running with the same or a shorter date list is a no-op.
     * @param {string} userId
     * @param {number} episodeId
     * @param {string[]} watchedDates
     * @returns {Promise<void>}
     */
    topUpWatched = async (userId, episodeId, watchedDates) => {
        const current = await this.getViews(userId, episodeId);

        for (const watchedAt of watchedDates.slice(current)) {
            await db.query(`
                INSERT INTO users_episodes (user_id, episode_id, watched_at)
                VALUES ($1, $2, $3)
            `, [userId, episodeId, watchedAt]);
        }
    }

    /**
     * Fills the existing placeholder for this episode, or inserts a new watched row if
     * none exists yet (e.g. the episode isn't part of an actively tracked season).
     * @param {string} userId
     * @param {number} episodeId
     * @returns {Promise<void>}
     */
    watch = async (userId, episodeId) => {
        const updated = await db.query(`
            UPDATE users_episodes
            SET watched_at = NOW()
            WHERE user_id = $1 AND episode_id = $2 AND watched_at IS NULL
        `, [userId, episodeId]);

        if (updated.rowCount === 0) {
            await db.query(`
                INSERT INTO users_episodes (user_id, episode_id, watched_at)
                VALUES ($1, $2, NOW())
            `, [userId, episodeId]);
        }
    }

    /**
     * Removes the most recent viewing. If it's the only one, the row is reverted to a
     * placeholder (watched_at = NULL) instead of being deleted.
     * @param {string} userId
     * @param {number} episodeId
     * @returns {Promise<boolean>} false when there was nothing to remove
     */
    unwatch = async (userId, episodeId) => {
        const res = await db.query(`
            SELECT id, COUNT(*) OVER () AS total
            FROM users_episodes
            WHERE user_id = $1 AND episode_id = $2 AND watched_at IS NOT NULL
            ORDER BY watched_at DESC
            LIMIT 1
        `, [userId, episodeId]);

        if (res.rowCount === 0) {
            return false;
        }
        const {id, total} = res.rows[0];

        if (parseInt(total) > 1) {
            await db.query(`DELETE FROM users_episodes WHERE id = $1`, [id]);
        } else {
            await db.query(`UPDATE users_episodes SET watched_at = NULL WHERE id = $1`, [id]);
        }
        return true;
    }

    /**
     * @param {string} userId
     * @param {number} episodeId
     * @returns {Promise<number>}
     */
    getViews = async (userId, episodeId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS views
            FROM users_episodes
            WHERE user_id = $1 AND episode_id = $2 AND watched_at IS NOT NULL
        `, [userId, episodeId]);
        return parseInt(res.rows[0]["views"] ?? 0);
    }

    /**
     * Checklist of every episode of a season for a user, with their view count.
     * @param {string} userId
     * @param {number} showId
     * @param {number} seasonNumber
     * @returns {Promise<UserEpisode[]>}
     */
    getBySeasonForUser = async (userId, showId, seasonNumber) => {
        const res = await db.query(`
            SELECT e.id, e.title, e.code, e.number, e.global, e.date,
                   COUNT(ue.id) FILTER (WHERE ue.watched_at IS NOT NULL) AS views
            FROM episodes e
            LEFT JOIN users_episodes ue ON ue.episode_id = e.id AND ue.user_id = $1
            WHERE e.show_id = $2 AND e.season_number = $3
            GROUP BY e.id
            ORDER BY e.number
        `, [userId, showId, seasonNumber]);
        return res.rows.map((row) => new UserEpisode(row));
    }
}
