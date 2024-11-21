const pool = require('../helpers/db');

/**
 * @param {string} userId 
 * @param {string} otherId 
 * @returns Promise<boolean>
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
    return parseInt(res["rows"][0]["total"]) === 1;
}

/**
 * @param {string} userId 
 * @param {string} otherId 
 * @returns Promise<boolean>
 */
const checkIfAlreadyFriend = async (userId, otherId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT COUNT(*) AS total
        FROM friends
        WHERE ((fst_user_id = $1 AND sec_user_id = $2) OR (fst_user_id = $2 AND sec_user_id = $1))
        AND accepted = TRUE
    `, [userId, otherId]);
    client.release();
    return parseInt(res["rows"][0]["total"]) === 1;
}

/**
 * @param {string} userId 
 * @param {string} otherId 
 */
const acceptFriend = async (userId, otherId) => {
    const client = await pool.connect();
    await client.query(`
        UPDATE friends
        SET accepted = TRUE
        WHERE (fst_user_id = $1 AND sec_user_id = $2)
        OR (fst_user_id = $2 AND sec_user_id = $1)
    `, [userId, otherId]);
    client.release();
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getFriends = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT u.id, u.email, u.picture, u.username
        FROM friends
        JOIN users u ON id = fst_user_id OR id = sec_user_id
        WHERE (fst_user_id = $1 OR sec_user_id = $1) 
        AND accepted = TRUE
        AND id <> $1
    `, [userId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getFriendsRequestsSend = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT u.id, u.email, u.picture, u.username
        FROM friends
        JOIN users u ON id = sec_user_id
        WHERE fst_user_id = $1 AND accepted = FALSE
    `, [userId]);
    client.release();
    return res["rows"];
}

const getFriendsWhoWatchSerie = async (userId, showId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT u.id, u.email, u.picture, u.username
        FROM users u
        JOIN users_shows us ON us.show_id = $2 AND u.id = us.user_id
        JOIN friends f ON u.id = f.fst_user_id OR u.id = f.sec_user_id
        WHERE (f.fst_user_id = $1 OR f.sec_user_id = $1) 
        AND f.accepted = TRUE
        AND u.id <> $1
    `, [userId, showId]);
    client.release();
    return res["rows"];
}

/**
 * @param {string} userId 
 * @returns Promise<any[]>
 */
const getFriendsRequestsReceive = async (userId) => {
    const client = await pool.connect();
    const res = await client.query(`
        SELECT u.id, u.email, u.picture, u.username
        FROM friends
        JOIN users u ON id = fst_user_id
        WHERE sec_user_id = $1 AND accepted = FALSE
    `, [userId]);
    client.release();
    return res["rows"];
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

/**
 * @param {string} userId 
 * @param {string} otherId
 */
const deleteFriend = async (userId, otherId) => {
    const client = await pool.connect();
    await client.query(`
        DELETE FROM friends
        WHERE (fst_user_id = $1 AND sec_user_id = $2)
        OR (fst_user_id = $2 AND sec_user_id = $1)
    `, [userId, otherId]);
    client.release();
}

module.exports = {
    checkIfAlreadyFriend,
    checkIfRelationExists,
    deleteFriend,
    getFriendsWhoWatchSerie,
    getFriendsRequestsSend,
    getFriendsRequestsReceive,
    acceptFriend,
    sendFriendRequest,
    getFriends
}