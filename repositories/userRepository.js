import db from "../config/db.js";
import User from "../models/user.js";
import ServiceError from "../helpers/serviceError.js";

export default class UserRepository {

    /**
     * @param {string} email
     * @returns {Promise<User|null>}
     */
    getUserByEmail = async (email) => {
        const res = await db.query(`
            SELECT *
            FROM users
            WHERE UPPER(email) = UPPER($1) 
            LIMIT 1
        `, [email]);
        return res.rowCount === 1 ? new User(res.rows[0]) : null;
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
     * @param {string} identifier
     * @returns {Promise<User|null>}
     */
    getUserByIdentifier = async (identifier) => {
        const res = await db.query(`
            SELECT *
            FROM users
            WHERE UPPER(username) = UPPER($1) OR UPPER(email) = UPPER($1) 
            LIMIT 1
        `, [identifier]);
        return res.rowCount === 1 ? new User(res.rows[0]) : null;
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
     * @param {string} email
     * @param {string} password
     * @param {string} username
     * @returns {Promise<boolean>}
     */
    createUser = async (email, password, username) => {
        const res = await db.query(`
            INSERT INTO users (email, password, username)
            VALUES ($1, $2, $3)
        `, [email, password, username]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} id
     * @param {string} field
     * @param {string} value
     * @returns {Promise<boolean>}
     */
    updateField = async (id, field, value) => {
        if (!User.isValidField(field)) {
            throw new ServiceError(400, `Champ incorrect : ${field}`);
        }
        const res = await db.query(`
            UPDATE users
            SET ${field} = $1
            WHERE id = $2
        `, [value, id]);
        return res.rowCount === 1;
    }
}