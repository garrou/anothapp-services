import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserEpisodeStatRepository from "../repositories/userEpisodeStatRepository.js";
import UserRepository from "../repositories/userRepository.js";
import Stat from "../models/stat.js";

export default class StatService {
    constructor() {
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._userEpisodeStatRepository = new UserEpisodeStatRepository();
        this._userRepository = new UserRepository();
    }

    /**
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    getStats = async (userId) => {
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);
        const repo = episodeTrackingEnabled ? this._userEpisodeStatRepository : this._userSeasonRepository;

        const stats = {
            "monthTime": await repo.getTimeCurrentMonthByUserId(userId),
            "totalTime": await repo.getTotalTimeByUserId(userId),
            "nbSeries": await this._userShowRepository.getTotalShowsByUserId(userId),
            "nbSeasons": await this._userSeasonRepository.getTotalSeasonsByUserId(userId),
            "nbEpisodes": await repo.getTotalEpisodesByUserId(userId),
            "bestMonth": (await repo.getRecordViewingTimeMonth(userId, 1))[0],
            "seasonsMonthCurrentYear": await this._userSeasonRepository.getNbSeasonsByUserIdGroupByMonthByCurrentYear(userId),
            "episodesMonthCurrentYear": await repo.getNbEpisodesByUserIdGroupByMonthByCurrentYear(userId),
            "timeYears": await repo.getTimeHourByUserIdGroupByYear(userId),
            "seasonsYears": await this._userSeasonRepository.getNbSeasonsByUserIdGroupByYear(userId),
            "episodesYears": await repo.getNbEpisodesByUserIdGroupByYear(userId),
            "seasonsMonths": await this._userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(userId),
            "bestMonths": await repo.getRecordViewingTimeMonth(userId, 10),
            "seriesRankingTime": await repo.getRankingViewingTimeByShows(userId),
            "seriesKinds": await this.#getNbKindsByUserId(userId),
            "seasonsPlatforms": await this._userSeasonRepository.getPlatformsByUserId(userId),
            "seriesCountries": await this._userShowRepository.getCountriesByUserId(userId, 200),
            "seriesNotes": await this._userShowRepository.getNotesByUserId(userId)
        };
        if (episodeTrackingEnabled) {
            stats.episodesHeatmap = await this._userEpisodeStatRepository.getWatchedByDay(userId);
        }
        return stats;
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