import db from "../config/db.js";
import RefreshToken from "../models/refreshToken.js";

export default class RefreshTokenRepository {

    /**
     * @param {string} userId 
     * @param {string} tokenHash 
     * @param {Date} expiresAt 
     * @returns {boolean}
     */
    create = async (userId, tokenHash, expiresAt) => {
        const res = await db.query(`
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
        `, [userId, tokenHash, expiresAt]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} hashToken 
     * @returns {RefreshToken}
     */
    find = async (hashToken) => {
        const res = await this._db.query(`
            SELECT *
            FROM refresh_tokens
            WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL
            LIMIT 1
        `, [hashToken]);
        return res.rowCount === 1 ? RefreshToken(res.rows[0]) : null;
    }

    /**
     * @param {string} tokenId 
     * @returns {boolean}
     */
    revoke = async (tokenId) => {
        const res = await this._db.query(`
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE id = $1
        `, [tokenId]);
        return res.rowCount === 1;
    }
}