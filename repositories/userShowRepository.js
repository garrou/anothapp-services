import db from "../config/db.js";

export default class UserShowRepository {

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    checkShowExistsByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_shows
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId]);
        return parseInt(res.rows[0]["total"]) === 1;
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
     * @param {number} limit
     * @returns {Promise<any[]>}
     */
    getShowsByUserId = async (userId, limit = 10) => {
        const res = await db.query(`
            SELECT s.*, us.favorite, us.added_at, us.continue
            FROM shows s
            JOIN users_shows us ON s.id = us.show_id
            WHERE us.user_id = $1
            ORDER BY us.added_at DESC
            LIMIT $2
        `, [userId, limit]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {string} id
     * @returns Promise<any>
     */
    getShowByUserIdByShowId = async (userId, id) => {
        const res = await db.query(`
            SELECT s.*, us.favorite, us.added_at, us.continue
            FROM shows s
            JOIN users_shows us ON s.id = us.show_id
            WHERE us.user_id = $1 AND us.show_id = $2 LIMIT 1
        `, [userId, id]);
        return res.rows[0];
    }

    /**
     * @param {string} userId
     * @param {string} title
     * @returns Promise<any[]>
     */
    getShowsByUserIdByTitle = async (userId, title) => {
        const res = await db.query(`
            SELECT s.*, us.favorite, us.added_at, us.continue
            FROM users_shows us
            JOIN shows s ON s.id = us.show_id
            WHERE user_id = $1 AND UPPER(s.title) LIKE UPPER($2)
            ORDER BY us.added_at DESC
        `, [userId, `%${title}%`]);
        return res.rows;
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
     * @param {number} showId
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
            WHERE user_id = $1 AND show_id = $2 RETURNING favorite
        `, [userId, showId]);
        return res.rows[0]["favorite"];
    }

    /**
     * @param {string} userId
     * @returns Promise<any[]>
     */
    getShowsToResumeByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.*, us.favorite, us.added_at, us.continue
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            WHERE us.user_id = $1 AND us.continue = FALSE AND s.seasons - (
                SELECT COUNT(distinct users_seasons.number)
                FROM shows
                JOIN users_seasons ON s.id = users_seasons.show_id
                WHERE users_seasons.user_id = $1 AND s.id = shows.id) > 0
            ORDER BY s.title
        `, [userId]);
        return res.rows;
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
     * @returns Promise<any[]>
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
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {number[]} platforms
     * @returns Promise<any[]>
     */
    getShowsByUserIdByPlatforms = async (userId, platforms) => {
        const res = await db.query(`
            SELECT DISTINCT s.*, us.favorite, us.added_at, us.continue
            FROM shows s
            JOIN users_shows us ON us.show_id = s.id
            JOIN users_seasons use ON us.user_id = use.user_id AND us.show_id = use.show_id
            WHERE us.user_id = $1 AND use.platform_id = ANY ($2)
            ORDER BY us.added_at DESC
        `, [userId, platforms]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @return Promise<any[]>
     */
    getFavoritesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.*, us.favorite, us.added_at, us.continue
            FROM users_shows us
            JOIN shows s ON s.id = us.show_id
            WHERE us.user_id = $1 AND favorite = TRUE
            ORDER BY s.title
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns Promise<any[]>
     */
    getShowsToContinueByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.*, s.seasons - (
                SELECT COUNT(DISTINCT users_seasons.number)
                FROM shows
                JOIN users_seasons ON s.id = users_seasons.show_id
                WHERE users_seasons.user_id = $1 AND s.id = shows.id
            ) as missing, us.added_at, us.continue, us.favorite
            FROM shows s
            JOIN users_shows us ON s.id = us.show_id
            WHERE us.user_id = $1 AND us.continue = TRUE
            ORDER BY s.title
        `, [userId]);
        return res.rows.filter((row) => row.missing > 0);
    }

    getSharedShowsWithFriend = async (userId, friendId) => {
        const res = await db.query(`
            SELECT s.*
            FROM shows s
            WHERE id in (
                SELECT show_id
                FROM users_shows
                WHERE user_id = $1
                INTERSECT
                SELECT show_id
                FROM users_shows
                WHERE user_id = $2)
            ORDER BY s.title
        `, [userId, friendId]);
        return res.rows;
    }
}