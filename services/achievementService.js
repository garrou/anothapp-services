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
import ServiceError from "../helpers/serviceError.js";
import {ERROR_NOT_FRIEND} from "../constants/errors.js";
import {isOwnRequest} from "../helpers/utils.js";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

const STAT_CODES = [
    "streak", "watch_time", "shows_started", "shows_completed", "countries",
    "kinds", "platforms", "friends_watched_with", "friends_count", "notes_count", "account_age",
];

const NAME_BY_CODE = new Map(ACHIEVEMENTS.map(({code, name}) => [code, name]));

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
     * @param {string} userId
     * @param {string[]} codes
     * @returns {Promise<Object<string, number>>}
     */
    #computeValues = async (userId, codes) => {
        const need = (code) => codes.includes(code);
        const needsRepo = need("streak") || need("watch_time");

        const episodeTrackingEnabled = needsRepo ? await this._userRepository.hasEpisodeTrackingEnabled(userId) : false;
        const repo = episodeTrackingEnabled ? this._userEpisodeStatRepository : this._userSeasonRepository;

        const [
            user, dates, minutes, showsStarted, showsCompleted, countries,
            kinds, platforms, friendsWatchedWith, friends, notedShows
        ] = await Promise.all([
            need("account_age") ? this._userRepository.getUserById(userId) : null,
            need("streak") ? repo.getWatchedDatesByUserId(userId) : null,
            need("watch_time") ? repo.getTotalTimeByUserId(userId) : null,
            need("shows_started") ? this._userShowRepository.getTotalShowsByUserId(userId) : null,
            need("shows_completed") ? this._userShowRepository.getTotalCompletedShowsByUserId(userId) : null,
            need("countries") ? this._userShowRepository.getCountriesCountByUserId(userId) : null,
            need("kinds") ? this._userShowRepository.getKindsCountByUserId(userId) : null,
            need("platforms") ? this._userSeasonRepository.getPlatformsCountByUserId(userId) : null,
            need("friends_watched_with") ? this._userSeasonFriendRepository.getDistinctFriendsCountByUserId(userId) : null,
            need("friends_count") ? this._friendRepository.getFriends(userId) : null,
            need("notes_count") ? this._userShowRepository.getNotedShowsCountByUserId(userId) : null,
        ]);

        const values = {};
        if (need("streak")) values.streak = computeStreak(dates).longest;
        if (need("watch_time")) values.watch_time = minutes / 60;
        if (need("shows_started")) values.shows_started = showsStarted;
        if (need("shows_completed")) values.shows_completed = showsCompleted;
        if (need("countries")) values.countries = countries;
        if (need("kinds")) values.kinds = kinds;
        if (need("platforms")) values.platforms = platforms;
        if (need("friends_watched_with")) values.friends_watched_with = friendsWatchedWith;
        if (need("friends_count")) values.friends_count = friends.length;
        if (need("notes_count")) values.notes_count = notedShows;
        if (need("account_age")) {
            values.account_age = user ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / MS_PER_MONTH) : 0;
        }
        return values;
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
     * @param {string} userId
     * @param {string[]} codes which achievement codes to re-check
     * @returns {Promise<void>}
     */
    evaluate = async (userId, codes = STAT_CODES) => {
        const [values, tiers, current] = await Promise.all([
            this.#computeValues(userId, codes),
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

            if (best.threshold <= existingThreshold) continue;

            const raised = await this._achievementRepository.upsertUserAchievement(userId, code, best.league, best.subTier);
            if (raised) {
                await this._notificationRepository.create(userId, undefined, "achievement_unlocked", undefined, {
                    code, name: NAME_BY_CODE.get(code), league: best.league, subTier: best.subTier,
                });
            }
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string?} friendId
     * @returns {Promise<Object[]>} every achievement with its current value, tier reached and next tier -
     * for a friend, only the ones actually unlocked (no value/progress leaked on the rest)
     */
    getAchievements = async (currentUserId, friendId) => {
        if (!isOwnRequest(currentUserId, friendId)
            && !await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new ServiceError(400, ERROR_NOT_FRIEND);
        }
        const userId = friendId ?? currentUserId;

        const [values, tiers, current] = await Promise.all([
            this.#computeValues(userId, STAT_CODES),
            this._achievementRepository.getTiers(),
            this._achievementRepository.getUserAchievements(userId),
        ]);
        const byCode = this.#groupTiersByCode(tiers);

        const achievements = ACHIEVEMENTS.map(({code, name}) => {
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

        return isOwnRequest(currentUserId, friendId)
            ? achievements
            : achievements.filter((achievement) => achievement.league !== null);
    }
}
