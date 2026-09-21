import db from "../config/db.js";
import UserAuth from "../models/userAuth.js";
import ServiceError from "../helpers/serviceError.js";

export default class UserAuthRepository {

    /**
     * @param {string} userId
     * @returns {Promise<UserAuth|null>}
     */
    getByUserId = async (userId) => {
        const res = await db.query(`
            SELECT * FROM users_auth WHERE user_id = $1
        `, [userId]);
        return res.rowCount === 1 ? new UserAuth(res.rows[0]) : null;
    }

    /**
     * @param {string} email
     * @returns {Promise<UserAuth|null>}
     */
    getByEmail = async (email) => {
        const res = await db.query(`
            SELECT * FROM users_auth WHERE UPPER(email) = UPPER($1) LIMIT 1
        `, [email]);
        return res.rowCount === 1 ? new UserAuth(res.rows[0]) : null;
    }

    /**
     * @param {string} identifier
     * @returns {Promise<{id: string, deletedAt: string|null, email: string, password: string}|null>}
     */
    findForLogin = async (identifier) => {
        const res = await db.query(`
            SELECT u.id, u.deleted_at, ua.email, ua.password_hash
            FROM users u
            JOIN users_auth ua ON ua.user_id = u.id
            WHERE UPPER(u.username) = UPPER($1) OR UPPER(ua.email) = UPPER($1)
            LIMIT 1
        `, [identifier]);

        if (res.rowCount !== 1) {
            return null;
        }
        const row = res.rows[0];
        return { id: row.id, deletedAt: row["deleted_at"], email: row.email, password: row["password_hash"] };
    }

    /**
     * @param {string} userId
     * @param {string} email
     * @param {string} passwordHash
     * @param {{query: Function}} [client]
     * @returns {Promise<boolean>}
     */
    create = async (userId, email, passwordHash, client = db) => {
        const res = await client.query(`
            INSERT INTO users_auth (user_id, email, password_hash)
            VALUES ($1, $2, $3)
        `, [userId, email, passwordHash]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {string} field
     * @param {*} value
     * @param {{query: Function}} [client]
     * @returns {Promise<boolean>}
     */
    updateField = async (userId, field, value, client = db) => {
        if (!UserAuth.isValidField(field)) {
            throw new ServiceError(400, `Champ incorrect : ${field}`);
        }
        const res = await client.query(`
            UPDATE users_auth
            SET ${field} = $1
            WHERE user_id = $2
        `, [value, userId]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    confirmPendingEmail = async (userId) => {
        const res = await db.query(`
            UPDATE users_auth
            SET email = pending_email, pending_email = NULL
            WHERE user_id = $1 AND pending_email IS NOT NULL
        `, [userId]);
        return res.rowCount === 1;
    }
}
