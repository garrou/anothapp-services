const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * @param {string} userId 
 * @param {string} secret 
 * @returns string
 */
const signJwt = (userId, secret) => jwt.sign(userId, secret);

/**
 * 
 * @param {string} token 
 * @param {string} secret 
 * @returns any
 */
const verifyJwt = (token, secret) => jwt.verify(token, secret);

/**
 * @returns string
 */
const uuid = () => uuidv4();

/**
 * @param {string} password 
 * @returns Promise<string>
 */
const createHash = async (password) => {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
}

/**
 * @param {string} password 
 * @param {string} hash 
 * @returns Promise<boolean>
 */
const comparePassword = (password, hash) => bcrypt.compare(password, hash);

module.exports = { signJwt, verifyJwt, uuid, createHash, comparePassword };