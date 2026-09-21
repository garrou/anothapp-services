import db from "../config/db.js";
import User from "../models/user.js";
import UserAuth from "../models/userAuth.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import RefreshTokenRepository from "./refreshTokenRepository.js";
import UserAuthRepository from "./userAuthRepository.js";

export default class UserRepository {

    constructor() {
        this._refreshTokenRepository = new RefreshTokenRepository();
        this._userAuthRepository = new UserAuthRepository();
    }

    /**
     * @param {string} username
     * @param {boolean} strict
     * @returns {Promise<User[]>}
     */
    getUsersByUsername = async (username, strict = false) => {
        const query = strict
        ? `SELECT * FROM users WHERE UPPER(username) = UPPER($1) LIMIT 1`
        : `SELECT * FROM users WHERE UPPER(username) LIKE UPPER($1) LIMIT $2`;

        const params = strict ? [username] : [`%${username}%`, 10];
        const res = await db.query(query, params);
        return res.rows.map((row) => new User(row));
    }

    /**
     * @param {string} id
     * @returns {Promise<User|null>}
     */
    getUserById = async (id) => {
        const res = await db.query(`
            SELECT *
            FROM users
            WHERE id = $1
        `, [id]);
        return res.rowCount === 1 ? new User(res.rows[0]) : null;
    }

    /**
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    getUserWithAuthById = async (id) => {
        const res = await db.query(`
            SELECT u.*, ua.user_id, ua.email, ua.password_hash, ua.email_verified, ua.pending_email
            FROM users u
            JOIN users_auth ua ON ua.user_id = u.id
            WHERE u.id = $1
        `, [id]);

        if (res.rowCount !== 1) {
            return null;
        }
        return { ...new User(res.rows[0]), ...new UserAuth(res.rows[0]) };
    }

    /**
     * @returns {Promise<number>}
     */
    getUserCount = async () => {
        const res = await db.query(`SELECT COUNT(*) AS total FROM users`);
        return parseInt(res.rows[0]["total"]);
    }

    /**
     * @returns {Promise<string[]>}
     */
    getAllUserIds = async () => {
        const res = await db.query(`SELECT id FROM users`);
        return res.rows.map((row) => row.id);
    }

    /**
     * @param {string} email
     * @param {string} passwordHash
     * @param {string} username
     * @returns {Promise<string|null>} the created user's id, or null on failure
     */
    createUser = async (email, passwordHash, username) => {
        return db.transaction(async (client) => {
            const res = await client.query(`
                INSERT INTO users (username)
                VALUES ($1)
                RETURNING id
            `, [username]);

            if (res.rowCount !== 1) {
                return null;
            }
            const userId = res.rows[0]["id"];
            const created = await this._userAuthRepository.create(userId, email, passwordHash, client);
            return created ? userId : null;
        });
    }

    /**
     * @param {string} id
     * @param {string} field
     * @param {string} value
     * @param {{query: Function}} [client]
     * @returns {Promise<boolean>}
     */
    updateField = async (id, field, value, client = db) => {
        if (!User.isValidField(field)) {
            throw new ServiceError(400, `Champ incorrect : ${field}`);
        }
        const res = await client.query(`
            UPDATE users
            SET ${field} = $1
            WHERE id = $2
        `, [value, id]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    markExported = async (id) => {
        const res = await db.query(`
            UPDATE users
            SET last_export = NOW()
            WHERE id = $1 AND (last_export IS NULL OR last_export <= NOW() - INTERVAL '1 day')
        `, [id]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    requestDeletion = async (id) => {
        return db.transaction(async (client) => {
            const res = await client.query(`
                UPDATE users
                SET deleted_at = NOW()
                WHERE id = $1
            `, [id]);

            if (res.rowCount !== 1) {
                return false;
            }
            await this._refreshTokenRepository.revokeAllForUser(id, client);
            return true;
        });
    }

    /**
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    cancelDeletion = async (id) => {
        const res = await db.query(`
            UPDATE users u
            SET deleted_at = NULL
            FROM users_auth ua
            WHERE u.id = $1 AND ua.user_id = u.id AND u.deleted_at IS NOT NULL AND ua.email NOT LIKE '%@anothapp.invalid'
        `, [id]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} graceDays
     * @returns {Promise<number>} number of accounts anonymized
     */
    anonymizeEligibleAccounts = async (graceDays) => {
        const unusablePasswordHash = await SecurityHelper.createDummyPassword();

        return db.transaction(async (client) => {
            const eligible = await client.query(`
                SELECT u.id
                FROM users u
                JOIN users_auth ua ON ua.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at <= NOW() - ($1 * INTERVAL '1 day')
                  AND ua.email NOT LIKE '%@anothapp.invalid'
                FOR UPDATE OF u
            `, [graceDays]);

            if (!eligible.rowCount) {
                return 0;
            }
            const ids = eligible.rows.map((row) => row.id);

            await client.query(`
                UPDATE users
                SET username = 'deleted-' || substr(md5(random()::text || id::text), 1, 16),
                    picture = NULL
                WHERE id = ANY($1::uuid[])
            `, [ids]);
            await client.query(`
                UPDATE users_auth
                SET email = 'deleted-' || user_id::text || '@anothapp.invalid',
                    password_hash = $2
                WHERE user_id = ANY($1::uuid[])
            `, [ids, unusablePasswordHash]);
            return eligible.rowCount;
        });
    }
}
