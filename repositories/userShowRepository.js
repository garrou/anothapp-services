import db from "../config/db.js";
import UserShow from "../models/userShow.js";

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
     * @param {string?} title
     * @param {number[]} platforms
     * @param {string[]} countries
     * @param {string[]} kinds
     * @returns {Promise<UserShow[]>}
     */
    getShowsByUserId = async (userId, title, platforms, countries, kinds) => {
        const res = await db.query(`
            SELECT DISTINCT s.*, us.favorite, us.added_at, us.continue
            FROM shows s
            JOIN users_shows us ON s.id = us.show_id
            LEFT JOIN users_seasons use ON us.user_id = use.user_id AND us.show_id = use.show_id
            WHERE us.user_id = $1
            AND (COALESCE($2, '') = '' OR s.title ILIKE $2)
            AND (CARDINALITY($3::INT[]) = 0 OR use.platform_id = ANY ($3))
            AND (CARDINALITY($4::VARCHAR[]) = 0 OR s.country ILIKE ANY ($4))
            AND (${db.generateCondition("s.kinds", "ILIKE", "AND", 5, kinds.length)})
            ORDER BY us.added_at DESC
        `, [userId, title ? `%${title}%` : null, platforms, countries, ...kinds.map((kind) => `%${kind}%`)]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @param {number} id
     * @returns {Promise<UserShow|null>}
     */
    getShowByUserIdByShowId = async (userId, id) => {
        const res = await db.query(`
            SELECT s.*, us.favorite, us.added_at, us.continue
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
     * @returns Promise<UserShow[]>
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
     * @return Promise<UserShow[]>
     */
    getFavoritesByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.*, us.favorite, us.added_at, us.continue
            FROM users_shows us
            JOIN shows s ON s.id = us.show_id
            WHERE us.user_id = $1 AND favorite = TRUE
            ORDER BY s.title
        `, [userId]);
        return res.rows.map((row) => new UserShow(row));
    }

    /**
     * @param {string} userId
     * @returns Promise<UserShow[]>
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
        return res.rows.reduce((acc, row) => {
            if (row.missing > 0) {
                acc.push(new UserShow(row));
            }
            return acc;
        }, []);
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
        return res.rows.map((row) => new UserShow(row));
    }
}