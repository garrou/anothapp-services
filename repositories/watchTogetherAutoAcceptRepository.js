import db from "../config/db.js";

export default class WatchTogetherAutoAcceptRepository {

    /**
     * @param {string} userId the prospective accepter
     * @param {string} friendUserId the prospective inviter
     * @returns {Promise<boolean>} true if userId auto-accepts watch-together invites from friendUserId
     */
    checkEnabled = async (userId, friendUserId) => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_auto_accept_watch_together
            WHERE user_id = $1 AND friend_user_id = $2
        `, [userId, friendUserId]);
        return parseInt(res.rows[0]["total"]) === 1;
    }

    /**
     * @param {string} userId
     * @param {string} friendUserId
     * @returns {Promise<void>}
     */
    enable = async (userId, friendUserId) => {
        await db.query(`
            INSERT INTO users_auto_accept_watch_together (user_id, friend_user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [userId, friendUserId]);
    }

    /**
     * @param {string} userId
     * @param {string} friendUserId
     * @returns {Promise<void>}
     */
    disable = async (userId, friendUserId) => {
        await db.query(`
            DELETE FROM users_auto_accept_watch_together
            WHERE user_id = $1 AND friend_user_id = $2
        `, [userId, friendUserId]);
    }

    /**
     * Clears the setting in both directions between two users - called when the friendship
     * itself ends, so a later re-friend never silently resurrects a stale preference.
     * @param {string} userIdA
     * @param {string} userIdB
     * @param {import("pg").PoolClient} client
     * @returns {Promise<void>}
     */
    removeAllBetweenUsers = async (userIdA, userIdB, client = db) => {
        await client.query(`
            DELETE FROM users_auto_accept_watch_together
            WHERE (user_id = $1 AND friend_user_id = $2) OR (user_id = $2 AND friend_user_id = $1)
        `, [userIdA, userIdB]);
    }
}
