import db from "../config/db.js";
import AchievementTier from "../models/achievementTier.js";

export default class AchievementRepository {

    /**
     * @returns {Promise<AchievementTier[]>}
     */
    getTiers = async () => {
        const res = await db.query(`
            SELECT code, league, sub_tier AS "subTier", threshold
            FROM achievement_tiers
        `);
        return res.rows.map((row) => new AchievementTier(row));
    }

    /**
     * @param {string} userId
     * @returns {Promise<Map<string, {league: number, subTier: number, unlockedAt: string}>>}
     */
    getUserAchievements = async (userId) => {
        const res = await db.query(`
            SELECT code, league, sub_tier AS "subTier", unlocked_at AS "unlockedAt"
            FROM users_achievements
            WHERE user_id = $1
        `, [userId]);
        return new Map(res.rows.map((row) => [row.code, row]));
    }

    /**
     * @param {string} userId
     * @param {string} code
     * @returns {Promise<{league: number, subTier: number}|null>}
     */
    getUserAchievement = async (userId, code) => {
        const res = await db.query(`
            SELECT league, sub_tier AS "subTier"
            FROM users_achievements
            WHERE user_id = $1 AND code = $2
        `, [userId, code]);
        return res.rowCount === 1 ? res.rows[0] : null;
    }

    /**
     * @param {string} userId
     * @param {string} code
     * @param {number} league
     * @param {number} subTier
     * @returns {Promise<void>}
     */
    upsertUserAchievement = async (userId, code, league, subTier) => {
        await db.query(`
            INSERT INTO users_achievements (user_id, code, league, sub_tier, unlocked_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id, code)
            DO UPDATE SET league = $3, sub_tier = $4, unlocked_at = NOW()
        `, [userId, code, league, subTier]);
    }
}
