import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export default class SecurityHelper {

    /**
     * @param {string} userId
     * @param {string} secret
     * @returns {string}
     */
    static signJwt = (userId, secret) => jwt.sign(userId, secret);

    /**
     *
     * @param {string} token
     * @param {string} secret
     * @returns {any}
     */
    static verifyJwt = (token, secret) => jwt.verify(token, secret);

    /**
     * @returns {string}
     */
    static generateUuid = () => uuidv4();

    /**
     * @param {string} password
     * @returns {Promise<string>}
     */
    static createHash = async (password) => {
        const salt = await bcrypt.genSalt();
        return bcrypt.hash(password, salt);
    }

    /**
     * @param {string} password
     * @param {string} hash
     * @returns {Promise<boolean>}
     */
    static comparePassword = (password, hash) => bcrypt.compare(password, hash);

}