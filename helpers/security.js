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
     * @param {string} [expiresIn]
     * @param {Object} [extraClaims] e.g. { jti } to tie the token to a specific server-side challenge
     * @returns {string}
     */
    static signJwt = (userId, secret, expiresIn = "15m", extraClaims = {}) =>
        jwt.sign({ sub: userId, ...extraClaims }, secret, { expiresIn });

    /**
     * @returns {string}
     */
    static deletionCancellationSecret = () => crypto
        .createHash("sha256")
        .update(`${process.env.JWT_SECRET}:deletion-cancellation`)
        .digest("hex");

    /**
     * @returns {string}
     */
    static emailVerificationSecret = () => crypto
        .createHash("sha256")
        .update(`${process.env.JWT_SECRET}:email-verification`)
        .digest("hex");

    /**
     * @returns {string}
     */
    static loginApprovalSecret = () => crypto
        .createHash("sha256")
        .update(`${process.env.JWT_SECRET}:login-approval`)
        .digest("hex");

    /**
     * @returns {string} a zero-padded 6-digit code
     */
    static generateLoginCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

    /**
     * @param {string} passwordHash
     * @returns {string}
     */
    static passwordResetSecret = (passwordHash) => crypto
        .createHash("sha256")
        .update(`${process.env.JWT_SECRET}:password-reset:${passwordHash}`)
        .digest("hex");

    /**
     * @param {string} token
     * @returns {any|null}
     */
    static decodeJwt = (token) => {
        try {
            return jwt.decode(token);
        } catch {
            return null;
        }
    };

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

    /**
     * @param {*} value
     * @returns {string}
     */
    static canonicalStringify = (value) => {
        if (value instanceof Date) {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map((item) => SecurityHelper.canonicalStringify(item) ?? "null").join(",")}]`;
        }
        if (value && typeof value === "object") {
            const entries = Object.keys(value)
                .filter((key) => value[key] !== undefined && typeof value[key] !== "function")
                .sort()
                .map((key) => `${JSON.stringify(key)}:${SecurityHelper.canonicalStringify(value[key])}`);
            return `{${entries.join(",")}}`;
        }
        return JSON.stringify(value);
    }

    /**
     * @returns {string}
     */
    static exportSignatureSecret = () => crypto
        .createHash("sha256")
        .update(`${process.env.JWT_SECRET}:export-signature`)
        .digest("hex");

    /**
     * @param {Object} data the export payload, without its own `signature` field
     * @returns {string} hex-encoded HMAC-SHA256
     */
    static signExportData = (data) => crypto
        .createHmac("sha256", SecurityHelper.exportSignatureSecret())
        .update(SecurityHelper.canonicalStringify(data))
        .digest("hex");

    /**
     * @param {Object} payload a parsed export file, signature field included
     * @returns {boolean}
     */
    static verifyExportSignature = (payload) => {
        if (!payload || typeof payload !== "object" || typeof payload.signature !== "string") {
            return false;
        }
        const { signature, ...rest } = payload;
        const expected = Buffer.from(SecurityHelper.signExportData(rest), "hex");
        const provided = Buffer.from(signature, "hex");

        return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
    }
}