import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ServiceError from "../helpers/serviceError.js";
import { ERROR_TOKEN_EXPIRED, ERROR_TOKEN_INVALID } from '../constants/errors.js';

export default class SecurityHelper {

    static jwtTokenExpires = 15 * 60 * 1000;

    static refreshTokenExpires = 30 * 24 * 60 * 60 * 1000;

    /**
     * @param {string} token 
     * @returns {string}
     */
    static hashToken = (token) => crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    /**
     * @param {string} userId
     * @param {string} secret
     * @returns {string}
     */
    static signJwt = (userId, secret) => jwt.sign({ sub: userId }, secret, { expiresIn: "15m" });

    /**
     * @returns {string}
     */
    static generateRefreshToken = () => crypto.randomBytes(64).toString("hex");

    /**
     *
     * @param {string} token
     * @param {string} secret
     * @returns {any}
     */
    static verifyJwt = (token, secret) => {
        try {
            return jwt.verify(token, secret);
        } catch (e) {
            if (e instanceof jwt.TokenExpiredError) {
                throw new ServiceError(401, ERROR_TOKEN_EXPIRED);
            }
            throw new ServiceError(401, ERROR_TOKEN_INVALID);
        }
    };

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