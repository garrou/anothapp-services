import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserSeasonFriendRepository from "../repositories/userSeasonFriendRepository.js";
import UserEpisodeStatRepository from "../repositories/userEpisodeStatRepository.js";
import UserRepository from "../repositories/userRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import ServiceError from "../helpers/serviceError.js";
import {ERROR_INVALID_REQUEST, ERROR_NOT_FRIEND} from "../constants/errors.js";
import {computeStreak} from "../helpers/streak.js";
import {isOwnRequest} from "../helpers/utils.js";

export default class StatService {
    constructor() {
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._userSeasonFriendRepository = new UserSeasonFriendRepository();
        this._userEpisodeStatRepository = new UserEpisodeStatRepository();
        this._userRepository = new UserRepository();
        this._friendRepository = new FriendRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {string?} friendId
     * @returns {Promise<Object>}
     */
    getStats = async (currentUserId, friendId) => {
        if (!isOwnRequest(currentUserId, friendId)
            && !await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new ServiceError(400, ERROR_NOT_FRIEND);
        }
        const userId = friendId ?? currentUserId;
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);
        const repo = episodeTrackingEnabled ? this._userEpisodeStatRepository : this._userSeasonRepository;

        const [
            monthTime, totalTime, nbSeries, nbSeasons, nbEpisodes, bestMonthRows,
            seasonsMonthCurrentYear, episodesMonthCurrentYear, timeYears, seasonsYears,
            episodesYears, seasonsMonths, bestMonths, seriesRankingTime, seriesKinds,
            seasonsPlatforms, seriesCountries, seriesNotes, watchedDates, topWatchedWithFriends
        ] = await Promise.all([
            repo.getTimeCurrentMonthByUserId(userId),
            repo.getTotalTimeByUserId(userId),
            this._userShowRepository.getTotalShowsByUserId(userId),
            this._userSeasonRepository.getTotalSeasonsByUserId(userId),
            repo.getTotalEpisodesByUserId(userId),
            repo.getRecordViewingTimeMonth(userId, 1),
            this._userSeasonRepository.getNbSeasonsByUserIdGroupByMonthByCurrentYear(userId),
            repo.getNbEpisodesByUserIdGroupByMonthByCurrentYear(userId),
            repo.getTimeHourByUserIdGroupByYear(userId),
            this._userSeasonRepository.getNbSeasonsByUserIdGroupByYear(userId),
            repo.getNbEpisodesByUserIdGroupByYear(userId),
            this._userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(userId),
            repo.getRecordViewingTimeMonth(userId, 10),
            repo.getRankingViewingTimeByShows(userId),
            this._userShowRepository.getKindsByUserId(userId),
            this._userSeasonRepository.getPlatformsByUserId(userId),
            this._userShowRepository.getCountriesByUserId(userId, 200),
            this._userShowRepository.getNotesByUserId(userId),
            repo.getWatchedDatesByUserId(userId),
            this._userSeasonFriendRepository.getTopFriendsByUserId(userId, 5),
        ]);
        const {current: currentStreak, longest: longestStreak} = computeStreak(watchedDates);

        const stats = {
            monthTime, totalTime, nbSeries, nbSeasons, nbEpisodes,
            "bestMonth": bestMonthRows[0],
            seasonsMonthCurrentYear, episodesMonthCurrentYear, timeYears, seasonsYears,
            episodesYears, seasonsMonths, bestMonths, seriesRankingTime, seriesKinds,
            seasonsPlatforms, seriesCountries, seriesNotes, currentStreak, longestStreak,
            topWatchedWithFriends
        };
        if (episodeTrackingEnabled) {
            stats.episodesHeatmap = await this._userEpisodeStatRepository.getWatchedByDay(userId);
        }
        return stats;
    }

    /**
     * @param {string} currentUserId
     * @param {number|string} year
     * @returns {Promise<Object>}
     */
    getWrapped = async (currentUserId, year) => {
        const numYear = parseInt(year);

        if (!numYear || numYear < 2000 || numYear > new Date().getFullYear()) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(currentUserId);
        const repo = episodeTrackingEnabled ? this._userEpisodeStatRepository : this._userSeasonRepository;

        const [
            totalTime, totalEpisodes, nbNewShows, topShow, topKind, topPlatform, bestMonth,
            watchedDates, topWatchedWithFriend
        ] = await Promise.all([
            repo.getTotalTimeByUserIdByYear(currentUserId, numYear),
            repo.getTotalEpisodesByUserIdByYear(currentUserId, numYear),
            this._userShowRepository.getNbShowsAddedByUserIdByYear(currentUserId, numYear),
            repo.getTopShowByUserIdByYear(currentUserId, numYear),
            repo.getKindsTimeByUserIdByYear(currentUserId, numYear),
            repo.getTopPlatformByUserIdByYear(currentUserId, numYear),
            repo.getBestMonthByUserIdByYear(currentUserId, numYear),
            repo.getWatchedDatesByUserIdByYear(currentUserId, numYear),
            this._userSeasonFriendRepository.getTopFriendByUserIdByYear(currentUserId, numYear),
        ]);

        return {
            year: numYear, totalTime, totalEpisodes, nbNewShows, topShow,
            topKind, topPlatform, bestMonth,
            bestStreak: computeStreak(watchedDates).longest, topWatchedWithFriend
        };
    }

    /**
     * @param {string} currentUserId
     * @returns {Promise<{id: string, username: string, picture: string?, value: number, isMe: boolean}[]>}
     */
    getLeaderboard = async (currentUserId) => {
        const [friends, me] = await Promise.all([
            this._friendRepository.getFriends(currentUserId),
            this._userRepository.getUserById(currentUserId),
        ]);
        const participants = [me, ...friends];
        const ids = participants.map((p) => p.id);
        const trackingByUserId = await this._userRepository.getEpisodeTrackingByIds(ids);

        const seasonIds = ids.filter((id) => !trackingByUserId.get(id));
        const episodeIds = ids.filter((id) => trackingByUserId.get(id));

        const [seasonTimes, episodeTimes] = await Promise.all([
            this._userSeasonRepository.getTimeCurrentMonthByUserIds(seasonIds),
            this._userEpisodeStatRepository.getTimeCurrentMonthByUserIds(episodeIds),
        ]);
        const timeByUserId = new Map([...seasonTimes, ...episodeTimes]);

        return participants
            .map((p) => ({
                id: p.id,
                username: p.username,
                picture: p.picture,
                value: timeByUserId.get(p.id) ?? 0,
                isMe: p.id === currentUserId
            }))
            .sort((a, b) => b.value - a.value);
    }

}