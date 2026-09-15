import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ServiceError from "../helpers/serviceError.js";
import { ERROR_TOKEN_EXPIRED, ERROR_TOKEN_INVALID } from '../constants/errors.js';
import { isProdMode } from './utils.js';

export default class SecurityHelper {

    static jwtTokenExpires = 15 * 60 * 1000;

    static refreshTokenExpires = 30 * 24 * 60 * 60 * 1000;

    static refreshPath = isProdMode() ? "/api/auth/refresh" : "/auth/refresh";

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
     * A secret distinct from JWT_SECRET, derived from it - a token signed with this one can never
     * be mistaken for a real access token by the auth guard, which only ever checks JWT_SECRET.
     * @returns {string}
     */
    static deletionCancellationSecret = () => crypto
        .createHash("sha256")
        .update(`${process.env.JWT_SECRET}:deletion-cancellation`)
        .digest("hex");

    /**
     * @returns {string}
     */
    static generateRefreshToken = () => crypto.randomBytes(64).toString("hex");

    /**
     * @param {string?} authHeader
     * @returns {string?}
     */
    static extractBearerToken = (authHeader) => {
        if (!authHeader) return undefined;
        const [type, token] = authHeader.split(" ");
        return type === "Bearer" && token ? token : undefined;
    };

    /**
     *
     * @param {string} token
     * @param {string} secret
     * @returns {any}
     */
    static verifyJwt = (token, secret) => {
        try {
            return jwt.verify(token, secret, { algorithms: ["HS256"] });
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

    /**
     * @returns {Promise<string>}
     */
    static createDummyPassword = async () => await this.createHash(crypto.randomBytes(32).toString("hex"));
}