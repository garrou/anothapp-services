import db from "../config/db.js";
import { MAX_LOGIN_CODE_ATTEMPTS } from "../constants/security.js";

export default class AdminRepository {

    /**
     * @param {number} days
     * @returns {Promise<{day: string, count: number}[]>}
     */
    getNewUsersByDay = async (days) => {
        const res = await db.query(`
            SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
            FROM users
            WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
            GROUP BY day
            ORDER BY day
        `, [days]);
        return res.rows.map((row) => ({ day: row.day, count: parseInt(row.count) }));
    }

    /**
     * @returns {Promise<number>}
     */
    getPendingDeletionsCount = async () => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users u
            JOIN users_auth ua ON ua.user_id = u.id
            WHERE u.deleted_at IS NOT NULL AND ua.email NOT LIKE '%@anothapp.invalid'
        `);
        return parseInt(res.rows[0].total);
    }

    /**
     * @returns {Promise<number>}
     */
    getAnonymizedCount = async () => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM users_auth
            WHERE email LIKE '%@anothapp.invalid'
        `);
        return parseInt(res.rows[0].total);
    }

    /**
     * @returns {Promise<number>}
     */
    getActiveSessionsCount = async () => {
        const res = await db.query(`
            SELECT COUNT(*) AS total
            FROM refresh_tokens
            WHERE revoked_at IS NULL AND expires_at > NOW()
        `);
        return parseInt(res.rows[0].total);
    }

    /**
     * @param {number} days
     * @returns {Promise<{userId: string, username: string, maxedOutCount: number, lastAttemptAt: string}[]>}
     */
    getLoginChallengesReachingAttemptLimit = async (days) => {
        const res = await db.query(`
            SELECT lc.user_id, u.username, COUNT(*) AS maxed_out_count, MAX(lc.created_at) AS last_attempt_at
            FROM login_challenges lc
            JOIN users u ON u.id = lc.user_id
            WHERE lc.created_at >= NOW() - ($1 * INTERVAL '1 day') AND lc.attempts >= $2
            GROUP BY lc.user_id, u.username
            ORDER BY maxed_out_count DESC
        `, [days, MAX_LOGIN_CODE_ATTEMPTS]);
        return res.rows.map((row) => ({
            userId: row["user_id"],
            username: row.username,
            maxedOutCount: parseInt(row["maxed_out_count"]),
            lastAttemptAt: row["last_attempt_at"],
        }));
    }

    /**
     * @param {string} query
     * @param {number} limit
     * @returns {Promise<{id: string, username: string, email: string}[]>}
     */
    searchUsers = async (query, limit) => {
        const res = await db.query(`
            SELECT u.id, u.username, ua.email
            FROM users u
            JOIN users_auth ua ON ua.user_id = u.id
            WHERE UPPER(u.username) LIKE UPPER($1) OR UPPER(ua.email) LIKE UPPER($1)
            LIMIT $2
        `, [`%${query}%`, limit]);
        return res.rows.map((row) => ({ id: row.id, username: row.username, email: row.email }));
    }
}
