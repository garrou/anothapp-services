import db from "../config/db.js";
import Show from "../models/show.js";

export default class UserListRepository {

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<boolean>}
     */
    create = async (userId, showId) => {
        const res = await db.query(`
            INSERT INTO users_list (user_id, show_id)
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
            DELETE FROM users_list
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns Promise<boolean>
     */
    checkShowExistsByUserIdByShowId = async (userId, showId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_list
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId]);
        return parseInt(res.rows[0]["total"]) === 1;
    }

    /**
     * @param {string} userId
     * @returns Promise<Show[]>
     */
    getNotStartedShowsByUserId = async (userId) => {
        const res = await db.query(`
            SELECT s.*
            FROM shows s
            JOIN users_list ul ON ul.show_id = s.id
            WHERE ul.user_id = $1
        `, [userId]);
        return res.rows.map((row) => new Show(row));
    }
}