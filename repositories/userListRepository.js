import pool from "../config/db.js";

export default class UserListRepository {

    /**
     * @param {string} userId
     * @param {number} showId
     */
    create = async (userId, showId) => {
        const client = await pool.connect();
        await client.query(`
            INSERT INTO users_list (user_id, show_id)
            VALUES ($1, $2)
        `, [userId, showId]);
        client.release();
    }

    /**
     * @param {string} userId
     * @param {number} showId
     */
    deleteByUserIdShowId = async (userId, showId) => {
        const client = await pool.connect();
        await client.query(`
            DELETE FROM users_list
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId]);
        client.release();
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns Promise<boolean>
     */
    checkShowExistsByUserIdByShowId = async (userId, showId) => {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT COUNT(*) AS total
            FROM users_list
            WHERE user_id = $1 AND show_id = $2
        `, [userId, showId]);
        client.release();
        return parseInt(res["rows"][0]["total"]) === 1;
    }

    /**
     * @param {string} userId
     * @returns Promise<any[]>
     */
    getNotStartedShowsByUserId = async (userId) => {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT s.*
            FROM shows s
            JOIN users_list ul ON ul.show_id = s.id
            WHERE ul.user_id = $1
        `, [userId]);
        client.release();
        return res["rows"];
    }
}