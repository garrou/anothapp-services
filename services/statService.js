import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserEpisodeStatRepository from "../repositories/userEpisodeStatRepository.js";
import UserRepository from "../repositories/userRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import ServiceError from "../helpers/serviceError.js";
import Stat from "../models/stat.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";

export default class StatService {
    constructor() {
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
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
        if (friendId && friendId !== currentUserId
            && !await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new ServiceError(400, "Vous n'êtes pas en relation avec cette personne");
        }
        const userId = friendId ?? currentUserId;
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);
        const repo = episodeTrackingEnabled ? this._userEpisodeStatRepository : this._userSeasonRepository;

        const [
            monthTime, totalTime, nbSeries, nbSeasons, nbEpisodes, bestMonthRows,
            seasonsMonthCurrentYear, episodesMonthCurrentYear, timeYears, seasonsYears,
            episodesYears, seasonsMonths, bestMonths, seriesRankingTime, seriesKinds,
            seasonsPlatforms, seriesCountries, seriesNotes
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
            this.#getNbKindsByUserId(userId),
            this._userSeasonRepository.getPlatformsByUserId(userId),
            this._userShowRepository.getCountriesByUserId(userId, 200),
            this._userShowRepository.getNotesByUserId(userId),
        ]);

        const stats = {
            monthTime, totalTime, nbSeries, nbSeasons, nbEpisodes,
            "bestMonth": bestMonthRows[0],
            seasonsMonthCurrentYear, episodesMonthCurrentYear, timeYears, seasonsYears,
            episodesYears, seasonsMonths, bestMonths, seriesRankingTime, seriesKinds,
            seasonsPlatforms, seriesCountries, seriesNotes
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

        const [totalTime, totalEpisodes, nbNewShows, topShow, kindsRows, topPlatform, bestMonth] = await Promise.all([
            repo.getTotalTimeByUserIdByYear(currentUserId, numYear),
            repo.getTotalEpisodesByUserIdByYear(currentUserId, numYear),
            this._userShowRepository.getNbShowsAddedByUserIdByYear(currentUserId, numYear),
            repo.getTopShowByUserIdByYear(currentUserId, numYear),
            repo.getKindsTimeByUserIdByYear(currentUserId, numYear),
            repo.getTopPlatformByUserIdByYear(currentUserId, numYear),
            repo.getBestMonthByUserIdByYear(currentUserId, numYear),
        ]);

        return {
            year: numYear, totalTime, totalEpisodes, nbNewShows, topShow,
            topKind: this.#topKindFromRows(kindsRows), topPlatform, bestMonth
        };
    }

    /**
     * @param {{kinds: string, value: number}[]} rows
     * @returns {Stat|null}
     */
    #topKindFromRows = (rows) => {
        const kindsMap = new Map();

        rows.forEach(({kinds, value}) => kinds.split(";").forEach((kind) => {
            kindsMap.set(kind, (kindsMap.get(kind) ?? 0) + value);
        }));
        let top = null;

        kindsMap.forEach((value, kind) => {
            if (!top || value > top.value) {
                top = Stat.from(kind, value);
            }
        });
        return top;
    }

    /**
     * @param {string} userId
     * @return Promise<{label: string, value: number}[]>
     */
    #getNbKindsByUserId = async (userId) => {
        const kindsMap = new Map();
        const rows = await this._userShowRepository.getKindsByUserId(userId);

        rows.forEach((row) => row["kinds"]
            .split(";")
            .forEach((kind) => {
                const val = kindsMap.get(kind);
                !val ? kindsMap.set(kind, 1) : kindsMap.set(kind, val + 1);
            })
        );
        return Array
            .from(kindsMap, ([kind, occur]) => Stat.from(kind, occur))
            .sort((a, b) => b.value - a.value)
            .splice(0, 10);
    }
}