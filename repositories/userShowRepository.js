import db from "../config/db.js";
import Stat from "../models/stat.js";
import UserShow from "../models/userShow.js";
import Recommendation from "../models/recommendation.js";

export default class UserShowRepository {

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    checkShowExistsByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT EXISTS(
                SELECT 1 FROM users_shows
                WHERE user_id = $1 AND show_id = $2
            ) AS exists
        `, [userId, showId]);
        return res.rows[0]["exists"];
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {{favorite?: boolean, watch?: boolean, note?: number|null, addedAt?: string|null}} [overrides] used on import, to restore the exported state instead of the defaults
     * @returns {Promise<boolean>}
     */
    create = async (userId, showId, overrides = {}) => {
        const {favorite = false, watch = true, note = null, addedAt = null} = overrides;
        const res = await db.query(`
            INSERT INTO users_shows (user_id, show_id, favorite, continue, note_id, added_at)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
        `, [userId, showId, favorite, watch, note, addedAt]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    deleteByUserIdShowId = async (userId, showId) => {
        const res = await db.query(`
            DELETE FROM users_shows
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {string?} title
     * @param {number[]} platforms
     * @param {string[]} countries
     * @param {string[]} kindIds
     * @param {number[]} notes
     * @param {string[]} friendIds
     * @returns {Promise<UserShow[]>}
     */
    getShowsByUserId = async (userId, title, platforms, countries, kindIds, notes, friendIds = []) => {
        const res = await db.query(`
            SELECT DISTINCT s.*, us.*,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names
            FROM shows s
            JOIN users_shows us ON s.id = us.show_id
            LEFT JOIN users_seasons use ON us.user_id = use.user_id AND us.show_id = use.show_id
            LEFT JOIN users_seasons_friends usf ON usf.users_season_id = use.id
            LEFT JOIN notes n ON n.id = us.note_id
            WHERE us.user_id = $1
            AND (COALESCE($2, '') = '' OR s.title ILIKE $2)
            AND (CARDINALITY($3::INT[]) = 0 OR use.platform_id = ANY ($3))
            AND (CARDINALITY($4::VARCHAR[]) = 0 OR s.country ILIKE ANY ($4))
            AND (CARDINALITY($5::INT[]) = 0 OR us.note_id = ANY ($5))
            AND (CARDINALITY($6::VARCHAR[]) = 0 OR EXISTS (
                SELECT 1 FROM shows_kinds sk
                WHERE sk.show_id = s.id AND sk.kind_id = ANY ($6)
            ))
            AND (CARDINALITY($7::uuid[]) = 0 OR usf.friend_user_id = ANY ($7))
            ORDER BY us.added_at DESC
        `, [
            userId,
            title ? `%${title}%` : null,
            platforms,
            countries,
            notes,
            kindIds,
            friendIds,
        ]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @returns {Promise<UserShow|null>}
     */
    getShowByUserIdByShowId = async (userId, id) => {
        const res = await db.query(`
            SELECT s.*, us.*,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names
            FROM shows s
            JOIN users_shows us ON s.id = us.show_id
            WHERE us.user_id = $1 AND us.show_id = $2
            LIMIT 1
        `, [userId, id]);
        return res.rowCount === 1 ? new UserShow(res.rows[0]) : null;
    }

    /**
     * @param {string} userId
     * @returns Promise<number>
     */
    getTotalShowsByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_shows
            WHERE user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns Promise<number> shows where every season has been watched
     */
    getTotalCompletedShowsByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM (
                SELECT us.show_id,
                    s.seasons - COUNT(DISTINCT us.number) AS missing_seasons,
                    (SELECT COALESCE(SUM(seasons.episodes), 0) FROM seasons WHERE seasons.show_id = s.id) - (
                        SELECT COUNT(DISTINCT ue.episode_id)
                        FROM users_episodes ue
                        JOIN users_seasons uss ON uss.id = ue.users_seasons_id
                        WHERE uss.user_id = $1 AND uss.show_id = s.id
                    ) AS missing_episodes
                FROM users_seasons us
                JOIN shows s ON s.id = us.show_id
                WHERE us.user_id = $1
                GROUP BY us.show_id, s.id, s.seasons
            ) completed
            WHERE missing_seasons <= 0 AND missing_episodes <= 0
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns Promise<number>
     */
    getNotedShowsCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_shows
            WHERE user_id = $1 AND note_id IS NOT NULL
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns Promise<number>
     */
    getFavoritesCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_shows
            WHERE user_id = $1 AND favorite = TRUE
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} year
     * @returns Promise<number>
     */
    getNbShowsAddedByUserIdByYear = async (userId, year) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_shows
            WHERE user_id = $1 AND EXTRACT(YEAR FROM added_at) = $2
        `, [userId, year]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    updateWatchingByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            UPDATE users_shows
            SET continue = NOT continue
            WHERE user_id = $1 AND show_id = $2
            RETURNING continue
        `, [userId, showId]);
        return res.rows[0]["continue"];
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    updateFavoriteByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            UPDATE users_shows
            SET favorite = NOT favorite
            WHERE user_id = $1 AND show_id = $2 
            RETURNING favorite
        `, [userId, showId]);
        return res.rows[0]["favorite"];
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {string} addedAt
     * @returns {Promise<boolean>}
     */
    updateAddedAtByUserIdByShowId = async (userId, showId, addedAt) => {
        const res = await db.query(`
            UPDATE users_shows
            SET added_at = $3
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId, addedAt]);
        return res.rowCount === 1;
    }

    /**
     * @param userId
     * @param showId
     * @param note
     * @returns {Promise<boolean>}
     */
    updateNoteByUserIdByShowId = async (userId, showId, note) => {
        const res = await db.query(`
            UPDATE users_shows
            SET note_id = $3
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId, note]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @returns Promise<UserShow[]>
     */
    getShowsToResumeByUserId = async (userId) => {
        const res = await db.query(`
            SELECT * FROM (
                SELECT s.*, us.*,
                    (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names,
                    s.seasons - (
                    SELECT COUNT(DISTINCT users_seasons.number)
                    FROM users_seasons
                    WHERE users_seasons.user_id = $1 AND users_seasons.show_id = s.id
                ) AS missing_seasons, (
                    SELECT COALESCE(SUM(seasons.episodes), 0) FROM seasons WHERE seasons.show_id = s.id
                ) - (
                    SELECT COUNT(DISTINCT ue.episode_id)
                    FROM users_episodes ue
                    JOIN users_seasons uss ON uss.id = ue.users_seasons_id
                    WHERE uss.user_id = $1 AND uss.show_id = s.id
                ) AS missing_episodes
                FROM shows s
                JOIN users_shows us ON us.show_id = s.id
                WHERE us.user_id = $1 AND us.continue = FALSE
            ) sub
            WHERE missing_seasons > 0 OR missing_episodes > 0
            ORDER BY title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<UserShow[]>
     */
    getShowsFinishedByUserId = async (userId) => {
        const res = await db.query(`
            SELECT * FROM (
                SELECT s.*, us.*,
                    (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names,
                    s.seasons - (
                    SELECT COUNT(DISTINCT users_seasons.number)
                    FROM users_seasons
                    WHERE users_seasons.user_id = $1 AND users_seasons.show_id = s.id
                ) AS missing_seasons, (
                    SELECT COALESCE(SUM(seasons.episodes), 0) FROM seasons WHERE seasons.show_id = s.id
                ) - (
                    SELECT COUNT(DISTINCT ue.episode_id)
                    FROM users_episodes ue
                    JOIN users_seasons uss ON uss.id = ue.users_seasons_id
                    WHERE uss.user_id = $1 AND uss.show_id = s.id
                ) AS missing_episodes
                FROM shows s
                JOIN users_shows us ON us.show_id = s.id
                WHERE us.user_id = $1 AND s.finished = TRUE
            ) sub
            WHERE missing_seasons = 0 AND missing_episodes = 0
            ORDER BY title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns Promise<Stat[]>
     */
    getKindsByUserId = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT k.name AS label, COUNT(*) AS value
            FROM users_shows us
            JOIN shows_kinds sk ON sk.show_id = us.show_id
            JOIN kinds k ON k.id = sk.kind_id
            WHERE us.user_id = $1
            GROUP BY k.name
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<number>
     */
    getKindsCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(DISTINCT sk.kind_id) AS total
            FROM users_shows us
            JOIN shows_kinds sk ON sk.show_id = us.show_id
            WHERE us.user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns Promise<Stat[]>
     */
    getCountriesByUserId = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT s.country AS label, COUNT(*) AS value
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            WHERE us.user_id = $1
            GROUP BY s.country
            ORDER BY value DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Stat(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<number>
     */
    getCountriesCountByUserId = async (userId) => {
        const res = await db.query(`
            SELECT COUNT(DISTINCT s.country) AS total
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            WHERE us.user_id = $1
        `, [userId]);
        return parseInt(res.rows[0]["total"] ?? 0);
    }

    /**
     * @param {string} userId
     * @returns {Promise<UserShow[]>}
     */
    getFavoritesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.*, us.*,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names
            FROM users_shows us
            JOIN shows s ON s.id = us.show_id
            WHERE us.user_id = $1 AND favorite = TRUE
            ORDER BY s.title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<UserShow[]>}
     */
    getShowsWithNextEpisode = async (userId) => {
        const res = await db.query(`
            SELECT s.*, us.*,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names
            FROM users_shows us
            JOIN shows s ON s.id = us.show_id
            WHERE us.user_id = $1 AND NULLIF(s.next_episode, '') IS NOT NULL AND us.continue = TRUE
            ORDER BY next_episode
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<UserShow[]>
     */
    getShowsToContinueByUserId = async (userId) => {
        const res = await db.query(`
            SELECT *
            FROM (
                SELECT s.*, us.added_at, us.continue, us.favorite,
                    (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names,
                    s.seasons - (
                        SELECT COUNT(DISTINCT users_seasons.number)
                        FROM users_seasons
                        WHERE users_seasons.user_id = $1 AND users_seasons.show_id = s.id
                    ) AS missing_seasons,
                    (SELECT COALESCE(SUM(seasons.episodes), 0) FROM seasons WHERE seasons.show_id = s.id) - (
                        SELECT COUNT(DISTINCT ue.episode_id)
                        FROM users_episodes ue
                        JOIN users_seasons uss ON uss.id = ue.users_seasons_id
                        WHERE uss.user_id = $1 AND uss.show_id = s.id
                    ) AS missing
                FROM shows s
                JOIN users_shows us ON s.id = us.show_id
                WHERE us.user_id = $1 AND us.continue = TRUE
            ) sub
            WHERE missing_seasons > 0 OR missing > 0
            ORDER BY title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     *
     * @param {string} userId
     * @param {string} friendId
     * @returns {Promise<UserShow[]>}
     */
    getSharedShowsWithFriend = async (userId, friendId) => {
        const res = await db.query(`
            SELECT s.*,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names
            FROM shows s
            JOIN users_shows us1 ON s.id = us1.show_id AND us1.user_id = $1
            JOIN users_shows us2 ON s.id = us2.show_id AND us2.user_id = $2
            ORDER BY s.title
        `, [userId, friendId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * Hybrid recommendation: a show qualifies because accepted friends rated it highly, because
     * its genres match genres the user themselves tends to rate highly, or because its cast
     * includes one of the user's favorite actors - whichever signal(s) apply are combined into
     * one score. The genre and actor paths cover users with few or no friends (the friends-only
     * version had no fallback for them), while the friend path alone still works for a user with
     * no ratings or favorite actors of their own.
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Recommendation[]>}
     */
    getRecommendationsByUserId = async (userId, limit = 10) => {
        const res = await db.query(`
            WITH user_genre_profile AS (
                SELECT sk.kind_id, AVG(us.note_id) AS avg_note
                FROM users_shows us
                JOIN shows_kinds sk ON sk.show_id = us.show_id
                WHERE us.user_id = $1 AND us.note_id IS NOT NULL
                GROUP BY sk.kind_id
                HAVING AVG(us.note_id) > 3
            ), friend_signal AS (
                SELECT us.show_id, COUNT(DISTINCT us.user_id) AS nb_friends, AVG(us.note_id) AS avg_note,
                    json_agg(json_build_object('id', u.id, 'username', u.username, 'picture', u.picture)) AS friends
                FROM users_shows us
                JOIN users u ON u.id = us.user_id
                JOIN friends f ON (f.fst_user_id = $1 AND f.sec_user_id = us.user_id)
                    OR (f.sec_user_id = $1 AND f.fst_user_id = us.user_id)
                WHERE f.accepted = TRUE AND us.note_id > 3
                GROUP BY us.show_id
            ), genre_signal AS (
                SELECT sk.show_id, AVG(ugp.avg_note) AS genre_score
                FROM shows_kinds sk
                JOIN user_genre_profile ugp ON ugp.kind_id = sk.kind_id
                GROUP BY sk.show_id
            ), actor_signal AS (
                SELECT sa.show_id, COUNT(DISTINCT sa.actor_id) AS nb_favorite_actors
                FROM shows_actors sa
                JOIN users_favorite_actors ufa ON ufa.actor_id = sa.actor_id AND ufa.user_id = $1
                GROUP BY sa.show_id
            )
            SELECT s.*,
                COALESCE(fs.nb_friends, 0) AS nb_friends,
                COALESCE(fs.avg_note, 0) AS avg_note,
                COALESCE(fs.friends, '[]'::json) AS friends,
                COALESCE(gs.genre_score, 0) AS genre_score,
                COALESCE(acs.nb_favorite_actors, 0) AS nb_favorite_actors,
                (SELECT COALESCE(array_agg(k.name ORDER BY k.name), '{}') FROM shows_kinds sk JOIN kinds k ON k.id = sk.kind_id WHERE sk.show_id = s.id) AS kind_names,
                (
                    0.5 * LEAST(COALESCE(fs.nb_friends, 0)::NUMERIC / 3, 1)
                  + 0.3 * (COALESCE(gs.genre_score, 0) / 5.0)
                  + 0.2 * LEAST(COALESCE(acs.nb_favorite_actors, 0)::NUMERIC / 2, 1)
                ) AS score
            FROM shows s
            LEFT JOIN friend_signal fs ON fs.show_id = s.id
            LEFT JOIN genre_signal gs ON gs.show_id = s.id
            LEFT JOIN actor_signal acs ON acs.show_id = s.id
            WHERE (fs.show_id IS NOT NULL OR gs.show_id IS NOT NULL OR acs.show_id IS NOT NULL)
                AND s.id NOT IN (SELECT show_id FROM users_shows WHERE user_id = $1)
                AND s.id NOT IN (SELECT show_id FROM users_list WHERE user_id = $1)
            ORDER BY score DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows.map((row) => new Recommendation(row));
    }

    /**
     * @param userId
     * @returns {Promise<Stat[]>}
     */
    getNotesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT n.id, n.name as label, COUNT(*) AS value
            FROM users_shows us
            JOIN notes n ON n.id = us.note_id
            WHERE us.user_id = $1
            GROUP BY id
            ORDER BY id
        `, [userId]);
        return res.rows.map((row) => new Stat(row));
    }
}