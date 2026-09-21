import db from "../config/db.js";
import LoginChallenge from "../models/loginChallenge.js";
import { MAX_LOGIN_CODE_ATTEMPTS } from "../constants/security.js";

export default class LoginChallengeRepository {

    /**
     * @param {string} userId
     * @param {string} codeHash
     * @param {Date} expiresAt
     * @returns {Promise<string>} the new challenge's id, used as the approval token's jti
     */
    create = async (userId, codeHash, expiresAt) => {
        const res = await db.query(`
            INSERT INTO login_challenges (user_id, code_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [userId, codeHash, expiresAt]);
        return res.rows[0].id;
    }

    /**
     * @param {string} userId
     * @returns {Promise<LoginChallenge|null>}
     */
    getMostRecentByUserId = async (userId) => {
        const res = await db.query(`
            SELECT * FROM login_challenges
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [userId]);
        return res.rowCount === 1 ? new LoginChallenge(res.rows[0]) : null;
    }

    /**
     * @param {string} userId
     * @param {string} challengeId
     * @returns {Promise<boolean>}
     */
    incrementAttempts = async (userId, challengeId) => {
        const res = await db.query(`
            UPDATE login_challenges
            SET attempts = attempts + 1
            WHERE id = $1 AND user_id = $2 AND confirmed_at IS NULL AND attempts < $3
        `, [challengeId, userId, MAX_LOGIN_CODE_ATTEMPTS]);
        return res.rowCount === 1;
    }

    /**
     * @param {string} userId
     * @param {string} challengeId
     * @param {string} codeHash
     * @returns {Promise<boolean>}
     */
    confirm = async (userId, challengeId, codeHash) => {
        const res = await db.query(`
            UPDATE login_challenges
            SET confirmed_at = NOW()
            WHERE id = $1
              AND user_id = $2
              AND code_hash = $3
              AND expires_at > NOW()
              AND attempts < $4
              AND confirmed_at IS NULL
              AND id = (
                  SELECT id FROM login_challenges WHERE user_id = $2 ORDER BY created_at DESC LIMIT 1
              )
        `, [challengeId, userId, codeHash, MAX_LOGIN_CODE_ATTEMPTS]);
        return res.rowCount === 1;
    }

    /**
     * @param {number} days
     * @returns {Promise<number>} number of challenges deleted
     */
    deleteOlderThanDays = async (days) => {
        const res = await db.query(`
            DELETE FROM login_challenges
            WHERE created_at < NOW() - ($1 * INTERVAL '1 day')
        `, [days]);
        return res.rowCount;
    }
}
