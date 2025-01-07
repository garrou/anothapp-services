import db from "../config/db.js";

export default class FriendRepository {

    /**
     * @param {string} userId
     * @param {string} otherId
     * @returns {Promise<boolean>}
     */
    checkIfRelationExists = async (userId, otherId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM friends
            WHERE (fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)
        `, [userId, otherId]);
        return parseInt(res.rows[0]["total"]) === 1;
    }

    /**
     * @param {string} userId
     * @param {string} otherId
     * @returns {Promise<boolean>}
     */
    checkIfAlreadyFriend = async (userId, otherId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM friends
            WHERE ((fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)) AND accepted = TRUE
        `, [userId, otherId]);
        return parseInt(res.rows[0]["total"]) === 1;
    }

    /**
     * @param userId
     * @param otherId
     * @returns {Promise<boolean>}
     */
    acceptFriend = async (userId, otherId) => {
        const res = await db.query(`
            UPDATE friends
            SET accepted = TRUE
            WHERE (fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)
        `, [userId, otherId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    getFriends = async (userId) => {
        const res = await db.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM friends
            JOIN users u ON id = fst_user_id OR id = sec_user_id
            WHERE (fst_user_id = $1 OR sec_user_id = $1) AND accepted = TRUE AND id <> $1
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    getFriendsRequestsSend = async (userId) => {
        const res = await db.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM friends
            JOIN users u ON id = sec_user_id
            WHERE fst_user_id = $1 AND accepted = FALSE
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @returns {Promise<any[]>}
     */
    getFriendsWhoWatchSerie = async (userId, showId) => {
        const res = await db.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM users u
            JOIN users_shows us ON us.show_id = $2 AND u.id = us.user_id
            JOIN friends f ON u.id = f.fst_user_id OR u.id = f.sec_user_id
            WHERE (f.fst_user_id = $1 OR f.sec_user_id = $1) AND f.accepted = TRUE AND u.id <> $1
        `, [userId, showId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @returns {Promise<any[]>}
     */
    getFriendsRequestsReceive = async (userId) => {
        const res = await db.query(`
            SELECT u.id, u.email, u.picture, u.username
            FROM friends
            JOIN users u ON id = fst_user_id
            WHERE sec_user_id = $1 AND accepted = FALSE
        `, [userId]);
        return res.rows;
    }

    /**
     * @param {string} userId
     * @param {string} otherId
     * @returns {Promise<boolean>}
     */
    sendFriendRequest = async (userId, otherId) => {
        const res = await db.query(`
            INSERT INTO friends (fst_user_id, sec_user_id)
            VALUES ($1, $2)
        `, [userId, otherId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {string} otherId
     * @returns {Promise<boolean>}
     */
    deleteFriend = async (userId, otherId) => {
        const res = await db.query(`
            DELETE FROM friends
            WHERE (fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1)
        `, [userId, otherId]);
        return res.rowCount === 1;
    }
}