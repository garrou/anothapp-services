import db from "../config/db.js";

export default class UserRepository {

    /**
     * @param {string} email
     * @returns {Promise<any[]>}
     */
    getUserByEmail = async (email) => {
        const res = await db.query(`
            SELECT id, email, picture, password, username
            FROM users
            WHERE UPPER(email) = UPPER($1) LIMIT 1
        `, [email]);
        return res.rows;
    }

    /**
     * @param {string} username
     * @param {boolean} strict
     */
    getUserByUsername = async (username, strict = false) => {
        const param = strict ? [`${username}`, 1] : [`%${username}%`, 10]
        const res = await db.query(`
            SELECT id, email, picture, password, username
            FROM users
            WHERE UPPER(username) LIKE UPPER($1)
                LIMIT $2
        `, param);
        return res.rows;
    }

    /**
     * @param {string} identifier
     */
    getUserByIdentifier = async (identifier) => {
        const res = await db.query(`
            SELECT id, email, picture, password, username
            FROM users
            WHERE UPPER(username) = UPPER($1)
               OR UPPER(email) = UPPER($1) LIMIT 1
        `, [identifier]);
        return res.rows;
    }

    /**
     * @param {string} id
     * @returns {Promise<any[]>}
     */
    getUserById = async (id) => {
        const res = await db.query(`
            SELECT id, email, picture, password, username
            FROM users
            WHERE id = $1
        `, [id]);
        return res.rows;
    }

    /**
     * @param {string} id
     * @param {string} email
     * @param {string} password
     * @param {string} username
     * @returns {Promise<boolean>}
     */
    createUser = async (id, email, password, username) => {
        const res = await db.query(`
            INSERT INTO users (id, email, password, username)
            VALUES ($1, $2, $3, $4)
        `, [id, email, password, username]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} id
     * @param {string} picture
     * @returns {Promise<boolean>}
     */
    updatePicture = async (id, picture) => {
        const res = await db.query(`
            UPDATE users
            SET picture = $1
            WHERE id = $2
        `, [picture, id]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} id
     * @param {string} hash
     * @returns {Promise<boolean>}
     */
    updatePassword = async (id, hash) => {
        const res = await db.query(`
            UPDATE users
            SET password = $1
            WHERE id = $2
        `, [hash, id]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} id
     * @param {string} email
     * @returns {Promise<boolean>}
     */
    updateEmail = async (id, email) => {
        const res = await db.query(`
            UPDATE users
            SET email = $1
            WHERE id = $2
        `, [email, id]);
        return res.rowCount === 1;
    }
}