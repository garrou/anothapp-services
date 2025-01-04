import pool from "../helpers/db.js";

export class FriendRepository {

    /**
     * @param {string} userId
     * @param {string} otherId
     * @returns Promise<boolean>
     */
    async checkIfRelationExists(userId, otherId) {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT COUNT(*) AS total
            FROM friends
            WHERE (fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)
        `, [userId, otherId]);
        client.release();
        return parseInt(res["rows"][0]["total"]) === 1;
    }

    /**
     * @param {string} userId
     * @param {string} otherId
     * @returns Promise<boolean>
     */
    async checkIfAlreadyFriend(userId, otherId) {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT COUNT(*) AS total
            FROM friends
            WHERE ((fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)) AND accepted = TRUE
        `, [userId, otherId]);
        client.release();
        return parseInt(res["rows"][0]["total"]) === 1;
    }

    /**
     * @param {string} userId
     * @param {string} otherId
     */
    async acceptFriend(userId, otherId) {
        const client = await pool.connect();
        await client.query(`
            UPDATE friends
            SET accepted = TRUE
            WHERE (fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)
        `, [userId, otherId]);
        client.release();
    }

    /**
     * @param {string} userId
     * @returns Promise<any[]>
     */
    async getFriends(userId) {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM friends
            JOIN users u ON id = fst_user_id OR id = sec_user_id
            WHERE (fst_user_id = $1 OR sec_user_id = $1) AND accepted = TRUE AND id <> $1
        `, [userId]);
        client.release();
        return res["rows"];
    }

    /**
     * @param {string} userId
     * @returns Promise<any[]>
     */
    async getFriendsRequestsSend(userId) {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM friends
            JOIN users u ON id = sec_user_id
            WHERE fst_user_id = $1 AND accepted = FALSE
        `, [userId]);
        client.release();
        return res["rows"];
    }

    async getFriendsWhoWatchSerie(userId, showId) {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM users u
            JOIN users_shows us ON us.show_id = $2 AND u.id = us.user_id
            JOIN friends f ON u.id = f.fst_user_id OR u.id = f.sec_user_id
            WHERE (f.fst_user_id = $1 OR f.sec_user_id = $1) AND f.accepted = TRUE AND u.id <> $1
        `, [userId, showId]);
        client.release();
        return res["rows"];
    }

    /**
     * @param {string} userId
     * @returns Promise<any[]>
     */
    async getFriendsRequestsReceive(userId) {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM friends
            JOIN users u ON id = fst_user_id
            WHERE sec_user_id = $1 AND accepted = FALSE
        `, [userId]);
        client.release();
        return res["rows"];
    }

    /**
     * @param {string} userId
     * @param {string} otherId
     */
    async sendFriendRequest(userId, otherId) {
        const client = await pool.connect();
        await client.query(`
            INSERT INTO friends (fst_user_id, sec_user_id)
            VALUES ($1, $2)
        `, [userId, otherId]);
        client.release();
    }

    /**
     * @param {string} userId
     * @param {string} otherId
     */
    async deleteFriend(userId, otherId) {
        const client = await pool.connect();
        await client.query(`
            DELETE FROM friends
            WHERE (fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)
        `, [userId, otherId]);
        client.release();
    }
}