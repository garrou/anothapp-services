const pool = require('../helpers/db');

/**
 * @param {string} email 
 * @returns Promise<any[]> 
 */
const getUserByEmail = async (email) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, email, picture, password
        FROM users
        WHERE email = $1
    `, [email]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} id 
 * @returns Promise<any[]> 
 */
const getUserById = async (id) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT id, email, picture, password
        FROM users
        WHERE id = $1
    `, [id]);
    client.release();       
    return res["rows"];
}

/**
 * @param {string} id 
 * @param {string} email 
 * @param {string} password 
 */
const createUser = async (id, email, password) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO users (id, email, password)
        VALUES ($1, $2, $3)
    `, [id, email, password]);
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

/**
 * @param {string} id 
 * @param {string} hash 
 */
const updatePassword = async (id, hash) => {
    const client = await pool.connect();
    await client.query(`
        UPDATE users
        SET password = $1
        WHERE id = $2
    `, [hash, id]);
    client.release();
}

/**
 * @param {string} id 
 * @param {string} email 
 */
const updateEmail = async (id, email) => {
    const client = await pool.connect();
    await client.query(`
        UPDATE users
        SET email = $1
        WHERE id = $2
    `, [email, id]);
    client.release();
}

module.exports = {
    createUser,
    getUserByEmail,
    getUserById,
    updateEmail,
    updatePassword,
    updatePicture
}