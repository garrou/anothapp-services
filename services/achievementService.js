import AchievementRepository from "../repositories/achievementRepository.js";
import UserRepository from "../repositories/userRepository.js";
import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserEpisodeStatRepository from "../repositories/userEpisodeStatRepository.js";
import UserSeasonFriendRepository from "../repositories/userSeasonFriendRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import NotificationRepository from "../repositories/notificationRepository.js";
import {computeStreak} from "../helpers/streak.js";
import {ACHIEVEMENTS} from "../constants/achievements.js";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

export default class AchievementService {
    constructor() {
        this._achievementRepository = new AchievementRepository();
        this._userRepository = new UserRepository();
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._userEpisodeStatRepository = new UserEpisodeStatRepository();
        this._userSeasonFriendRepository = new UserSeasonFriendRepository();
        this._friendRepository = new FriendRepository();
        this._notificationRepository = new NotificationRepository();
    }

    /**
     * Raw progress value per achievement code, for every code driven by a live stat
     * (excludes "leaderboard_top3", which is only ever set by unlockLeaderboardTop3).
     * @param {string} userId
     * @returns {Promise<Object<string, number>>}
     */
    #computeValues = async (userId) => {
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);
        const repo = episodeTrackingEnabled ? this._userEpisodeStatRepository : this._userSeasonRepository;

        const [
            user, dates, minutes, showsStarted, showsCompleted, countries,
            kinds, platforms, friendsWatchedWith, friends, notedShows
        ] = await Promise.all([
            this._userRepository.getUserById(userId),
            repo.getWatchedDatesByUserId(userId),
            repo.getTotalTimeByUserId(userId),
            this._userShowRepository.getTotalShowsByUserId(userId),
            this._userShowRepository.getTotalCompletedShowsByUserId(userId),
            this._userShowRepository.getCountriesCountByUserId(userId),
            this._userShowRepository.getKindsCountByUserId(userId),
            this._userSeasonRepository.getPlatformsCountByUserId(userId),
            this._userSeasonFriendRepository.getDistinctFriendsCountByUserId(userId),
            this._friendRepository.getFriends(userId),
            this._userShowRepository.getNotedShowsCountByUserId(userId),
        ]);
        const accountAgeMonths = user ? (Date.now() - new Date(user.createdAt).getTime()) / MS_PER_MONTH : 0;

        return {
            streak: computeStreak(dates).longest,
            watch_time: minutes / 60,
            shows_started: showsStarted,
            shows_completed: showsCompleted,
            countries,
            kinds,
            platforms,
            friends_watched_with: friendsWatchedWith,
            friends_count: friends.length,
            notes_count: notedShows,
            account_age: Math.floor(accountAgeMonths),
        };
    }

    /**
     * @param {import("../models/achievementTier.js").default[]} tiers
     * @returns {Map<string, import("../models/achievementTier.js").default[]>} per-code tiers, ascending by threshold
     */
    #groupTiersByCode = (tiers) => {
        const byCode = new Map();
        for (const tier of tiers) {
            if (!byCode.has(tier.code)) byCode.set(tier.code, []);
            byCode.get(tier.code).push(tier);
        }
        for (const rows of byCode.values()) rows.sort((a, b) => a.threshold - b.threshold);
        return byCode;
    }

    /**
     * Re-evaluates every stat-driven achievement for a user, persisting and notifying
     * any newly reached tier. Safe to call repeatedly; a no-op when nothing improved.
     * @param {string} userId
     * @returns {Promise<void>}
     */
    evaluate = async (userId) => {
        const [values, tiers, current] = await Promise.all([
            this.#computeValues(userId),
            this._achievementRepository.getTiers(),
            this._achievementRepository.getUserAchievements(userId),
        ]);
        const byCode = this.#groupTiersByCode(tiers);

        for (const [code, value] of Object.entries(values)) {
            const rows = byCode.get(code) ?? [];
            const best = [...rows].reverse().find((tier) => value >= tier.threshold);

            if (!best) continue;

            const existing = current.get(code);
            const existingThreshold = existing
                ? rows.find((t) => t.league === existing.league && t.subTier === existing.subTier)?.threshold ?? -Infinity
                : -Infinity;

            if (best.threshold > existingThreshold) {
                await this._achievementRepository.upsertUserAchievement(userId, code, best.league, best.subTier);
                await this._notificationRepository.create(userId, undefined, "achievement_unlocked", undefined, {
                    code, league: best.league, subTier: best.subTier,
                });
            }
        }
    }

    /**
     * Unlocks the single-tier "leaderboard_top3" achievement, called by the monthly
     * leaderboard task for each participant who ranked top 3 that month.
     * @param {string} userId
     * @returns {Promise<void>}
     */
    unlockLeaderboardTop3 = async (userId) => {
        const existing = await this._achievementRepository.getUserAchievement(userId, "leaderboard_top3");
        if (existing) return;

        await this._achievementRepository.upsertUserAchievement(userId, "leaderboard_top3", 1, 1);
        await this._notificationRepository.create(userId, undefined, "achievement_unlocked", undefined, {
            code: "leaderboard_top3", league: 1, subTier: 1,
        });
    }

    /**
     * @param {string} userId
     * @returns {Promise<Object[]>} every achievement with its current value, tier reached and next tier
     */
    getAchievements = async (userId) => {
        const [values, tiers, current] = await Promise.all([
            this.#computeValues(userId),
            this._achievementRepository.getTiers(),
            this._achievementRepository.getUserAchievements(userId),
        ]);
        const byCode = this.#groupTiersByCode(tiers);

        return ACHIEVEMENTS.map(({code, name}) => {
            const rows = byCode.get(code) ?? [];
            const value = values[code] ?? 0;
            const reached = current.get(code) ?? null;
            const reachedRow = reached
                ? rows.find((t) => t.league === reached.league && t.subTier === reached.subTier)
                : undefined;
            const reachedIndex = reachedRow ? rows.indexOf(reachedRow) : -1;
            const next = rows[reachedIndex + 1] ?? null;
            const floor = reachedRow?.threshold ?? 0;
            const progress = next ? Math.min(1, Math.max(0, (value - floor) / (next.threshold - floor))) : 1;

            return {
                code, name, value,
                league: reachedRow?.league ?? null,
                subTier: reachedRow?.subTier ?? null,
                unlockedAt: reached?.unlockedAt ?? null,
                nextLeague: next?.league ?? null,
                nextSubTier: next?.subTier ?? null,
                nextThreshold: next?.threshold ?? null,
                progress,
            };
        });
    }
}
