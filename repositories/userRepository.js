const pool = require('../helpers/db');

/**
 * @param {string} email 
 * @returns QueryResult 
 */
const getByEmail = async (email) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT *
            FROM users
            WHERE email = $1
        `, [email]);
        client.release();

        return res;
    } catch (err) {
        throw err;
    }
}

/**
 * @param {string} id 
 * @returns QueryResult 
 */
const getById = async (id) => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT * 
            FROM users
            WHERE id = $1
        `, [id]);
        client.release();
        
        return res;
    } catch (err) {
        throw err;
    }
}

/**
 * @param {string} id 
 * @param {string} email 
 * @param {string} name 
 */
const create = async (id, email, name) => {
    try {
        const client = await pool.connect();
        await client.query(`
            INSERT INTO users (id, email, name)
            VALUES ($1, $2, $3)
        `, [id, email, name]);
        client.release();
    } catch (err) {
        console.log(err);
        throw err;
    }
}

/**
 * @param {string} id 
 * @param {string} picture 
 */
const updatePicture = async (id, picture) => {
    try {
        const client = await pool.connect();
        await client.query(`
            UPDATE users
            SET picture = $1
            WHERE id = $2
        `, [picture, id]);
        client.release();
    } catch (err) {
        throw err;
    }
}

module.exports = {
    create,
    getByEmail,
    getById,
    updatePicture
}