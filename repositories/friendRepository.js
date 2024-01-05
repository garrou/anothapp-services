const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @param {string} otherId 
 * @returns Promise<number>
 */
const checkIfRelationExists = async (userId, otherId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT COUNT(*) AS total
        FROM friends
        WHERE (fst_user_id = $1 AND sec_user_id = $2)
        OR (fst_user_id = $2 AND sec_user_id = $1)
    `, [userId, otherId]);
    client.release();
    return res["rows"][0]["total"];
}

/**
 * @param {string} userId 
 * @param {string} otherId 
 */
const updateFriendRequest = async (userId, otherId) => {
    const client = await pool.connect();
    await client.query(`
        UPDATE friends
        SET validated = NOT validated
        WHERE fst_user_id = $1 AND sec_user_id = $2
    `, [userId, otherId]);
    client.release();
}

/**
 * @param {string} userId 
 * @returns Promise<QueryResult>
 */
const getFriends = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT u.id, u.email, u.picture
        FROM friends
        JOIN users u ON id = fst_user_id OR id = sec_user_id
        WHERE (fst_user_id = $1 OR sec_user_id = $1) AND validated = TRUE
    `, [userId]);
    client.release();
    return res;
}

/**
 * @param {string} userId 
 * @returns Promise<QueryResult>
 */
const getFriendsRequestsSend = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT u.id, u.email, u.picture
        FROM friends
        JOIN users u ON id = sec_user_id
        WHERE fst_user_id = $1 AND validated = FALSE
    `, [userId]);
    client.release();
    return res;
}

/**
 * @param {string} userId 
 * @returns Promise<QueryResult>
 */
const getFriendsRequestsReceive = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT u.id, u.email, u.picture
        FROM friends
        JOIN users u ON id = fst_user_id
        WHERE sec_user_id = $1 AND validated = FALSE
    `, [userId]);
    client.release();
    return res;
}

/**
 * @param {string} userId 
 * @param {string} otherId 
 */
const sendFriendRequest = async (userId, otherId) => {
    const client = await pool.connect();
    await client.query(`
        INSERT INTO friends (fst_user_id, sec_user_id)
        VALUES ($1, $2)
    `, [userId, otherId]);
    client.release();
}

module.exports = {
    checkIfRelationExists,
    getFriendsRequestsSend,
    getFriendsRequestsReceive,
    updateFriendRequest,
    sendFriendRequest,
    getFriends
}