const pool = require('../helpers/db');

/**
 * @param {string} email 
 * @returns QueryResult 
 */
const getUserByEmail = async (email) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT *
        FROM users
        WHERE email = $1
    `, [email]);
    client.release();

    return res;
}

/**
 * @param {string} id 
 * @returns QueryResult 
 */
const getUserById = async (id) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT * 
        FROM users
        WHERE id = $1
    `, [id]);
    client.release();
        
    return res;
}

/**
 * @param {string} id 
 * @param {string} email 
 * @param {string} name 
 */
const createUser = async (id, email, name) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO users (id, email, name)
        VALUES ($1, $2, $3)
    `, [id, email, name]);
    client.release();
}

/**
 * @param {string} id 
 * @param {string} picture 
 */
const updatePicture = async (id, picture) => {
    const client = await pool.connect();
    await client.query(`
        UPDATE users
        SET picture = $1
        WHERE id = $2
    `, [picture, id]);
    client.release();
}

module.exports = {
    createUser,
    getUserByEmail,
    getUserById,
    updatePicture
}