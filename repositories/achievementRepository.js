import Cache from "node-cache";
import db from "../config/db.js";
import AchievementTier from "../models/achievementTier.js";

const TIERS_CACHE_KEY = "tiers";
const TIERS_CACHE_TTL_SECONDS = 600;

// Module-level: achievement_tiers is edited directly in the DB (never through the app), so a
// short TTL is enough to pick up a change without re-fetching this ~200-row table on every
// single evaluate() call - which fires per watch event, including one per episode.
const tiersCache = new Cache({stdTTL: TIERS_CACHE_TTL_SECONDS, checkperiod: 60});

export default class AchievementRepository {

    /**
     * @returns {Promise<AchievementTier[]>}
     */
    getTiers = async () => {
        const cached = tiersCache.get(TIERS_CACHE_KEY);
        if (cached) {
            return cached;
        }
        const res = await db.query(`
            SELECT code, league, sub_tier AS "subTier", threshold
            FROM achievement_tiers
        `);
        const tiers = res.rows.map((row) => new AchievementTier(row));
        tiersCache.set(TIERS_CACHE_KEY, tiers);
        return tiers;
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
     * Only writes when this is a genuine improvement over whatever tier is already
     * stored - checked against the row as it stands at write time (not a snapshot
     * read earlier), so two concurrent evaluations for the same user can't race
     * a higher tier back down to a lower one.
     * @param {string} userId
     * @param {string} code
     * @param {number} league
     * @param {number} subTier
     * @returns {Promise<boolean>} true if this call actually raised the tier
     */
    upsertUserAchievement = async (userId, code, league, subTier) => {
        const res = await db.query(`
            INSERT INTO users_achievements (user_id, code, league, sub_tier, unlocked_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id, code) DO UPDATE
            SET league = EXCLUDED.league, sub_tier = EXCLUDED.sub_tier, unlocked_at = NOW()
            WHERE users_achievements.league < EXCLUDED.league
               OR (users_achievements.league = EXCLUDED.league AND users_achievements.sub_tier > EXCLUDED.sub_tier)
        `, [userId, code, league, subTier]);
        return res.rowCount === 1;
    }
}
