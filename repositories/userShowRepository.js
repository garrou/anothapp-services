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
     * @returns {Promise<boolean>}
     */
    create = async (userId, showId) => {
        const res = await db.query(`
            INSERT INTO users_shows (user_id, show_id)
            VALUES ($1, $2)
        `, [userId, showId]);
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
     * @param {string[]} kinds
     * @param {number[]} notes
     * @returns {Promise<UserShow[]>}
     */
    getShowsByUserId = async (userId, title, platforms, countries, kinds, notes) => {
        const res = await db.query(`
            SELECT DISTINCT s.*, us.*
            FROM shows s
            JOIN users_shows us ON s.id = us.show_id
            LEFT JOIN users_seasons use ON us.user_id = use.user_id AND us.show_id = use.show_id
            LEFT JOIN notes n ON n.id = us.note_id
            WHERE us.user_id = $1
            AND (COALESCE($2, '') = '' OR s.title ILIKE $2)
            AND (CARDINALITY($3::INT[]) = 0 OR use.platform_id = ANY ($3))
            AND (CARDINALITY($4::VARCHAR[]) = 0 OR s.country ILIKE ANY ($4))
            AND (CARDINALITY($5::INT[]) = 0 OR us.note_id = ANY ($5))
            AND (${db.generateCondition("s.kinds", "ILIKE", "AND", 6, kinds.length)})
            ORDER BY us.added_at DESC
        `, [
            userId,
            title ? `%${title}%` : null,
            platforms,
            countries,
            notes,
            ...kinds.map((kind) => `%${kind}%`),
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
            SELECT s.*, us.*
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
     * @return Promise<boolean>
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
            SELECT s.*, us.*
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            WHERE us.user_id = $1 AND us.continue = FALSE AND s.seasons - (
                SELECT COUNT(DISTINCT users_seasons.number)
                FROM users_seasons
                WHERE users_seasons.user_id = $1 AND users_seasons.show_id = s.id
            ) > 0
            ORDER BY s.title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<UserShow[]>
     */
    getShowsToResumeByUserIdEpisodes = async (userId) => {
        const res = await db.query(`
            SELECT * FROM (
                SELECT s.*, us.*, s.seasons - (
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
            SELECT s.*, us.*
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            WHERE us.user_id = $1 AND s.finished = TRUE AND s.seasons - (
                SELECT COUNT(DISTINCT users_seasons.number)
                FROM users_seasons
                WHERE users_seasons.user_id = $1 AND users_seasons.show_id = s.id
            ) = 0
            ORDER BY s.title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<UserShow[]>
     */
    getShowsFinishedByUserIdEpisodes = async (userId) => {
        const res = await db.query(`
            SELECT * FROM (
                SELECT s.*, us.*, s.seasons - (
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
     * @returns Promise<any[]>
     */
    getKindsByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.kinds
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            WHERE us.user_id = $1
        `, [userId]);
        return res.rows;
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
     * @return Promise<UserShow[]>
     */
    getFavoritesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.*, us.*
            FROM users_shows us
            JOIN shows s ON s.id = us.show_id
            WHERE us.user_id = $1 AND favorite = TRUE
            ORDER BY s.title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @return Promise<UserShow[]>
     */
    getShowsWithNextEpisode = async (userId) => {
        const res = await db.query(`
            SELECT s.*, us.*
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
                SELECT s.*, us.added_at, us.continue, us.favorite, s.seasons - (
                    SELECT COUNT(DISTINCT users_seasons.number)
                    FROM users_seasons
                    WHERE users_seasons.user_id = $1 AND users_seasons.show_id = s.id
                ) AS missing
                FROM shows s
                JOIN users_shows us ON s.id = us.show_id
                WHERE us.user_id = $1 AND us.continue = TRUE
            ) sub
            WHERE missing > 0
            ORDER BY title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<UserShow[]>
     */
    getShowsToContinueByUserIdEpisodes = async (userId) => {
        const res = await db.query(`
            SELECT *
            FROM (
                SELECT s.*, us.added_at, us.continue, us.favorite, s.seasons - (
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
            SELECT s.*
            FROM shows s
            JOIN users_shows us1 ON s.id = us1.show_id AND us1.user_id = $1
            JOIN users_shows us2 ON s.id = us2.show_id AND us2.user_id = $2
            ORDER BY s.title
        `, [userId, friendId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @param {number} limit
     * @returns {Promise<Recommendation[]>}
     */
    getRecommendationsByUserId = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT s.*, COUNT(DISTINCT us.user_id) AS nb_friends, AVG(us.note_id) AS avg_note,
                json_agg(json_build_object('id', u.id, 'username', u.username, 'picture', u.picture)) AS friends
            FROM users_shows us
            JOIN shows s ON s.id = us.show_id
            JOIN users u ON u.id = us.user_id
            JOIN friends f ON (f.fst_user_id = $1 AND f.sec_user_id = us.user_id)
                OR (f.sec_user_id = $1 AND f.fst_user_id = us.user_id)
            WHERE f.accepted = TRUE
                AND us.note_id > 3
                AND us.show_id NOT IN (SELECT show_id FROM users_shows WHERE user_id = $1)
                AND us.show_id NOT IN (SELECT show_id FROM users_list WHERE user_id = $1)
            GROUP BY s.id
            ORDER BY nb_friends DESC, avg_note DESC
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