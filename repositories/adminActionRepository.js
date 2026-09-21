import db from "../config/db.js";
import AdminAction from "../models/adminAction.js";

export default class AdminActionRepository {

    /**
     * @param {string} adminUserId
     * @param {string} action
     * @param {string?} targetUserId
     * @param {{query: Function}} [client]
     * @returns {Promise<string>} the new row's id
     */
    create = async (adminUserId, action, targetUserId = null, client = db) => {
        const res = await client.query(`
            INSERT INTO admin_actions (admin_user_id, action, target_user_id)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [adminUserId, action, targetUserId]);
        return res.rows[0].id;
    }

    /**
     * @param {number} limit
     * @returns {Promise<AdminAction[]>}
     */
    getRecent = async (limit = 50) => {
        const res = await db.query(`
            SELECT id, admin_user_id, action, target_user_id, created_at
            FROM admin_actions
            ORDER BY created_at DESC
            LIMIT $1
        `, [limit]);
        return res.rows.map((row) => new AdminAction(row));
    }
}
