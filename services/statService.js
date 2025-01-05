import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";

export default class StatService {
    constructor() {
        this.userShowRepository = new UserShowRepository();
        this.userSeasonRepository = new UserSeasonRepository();
    }

    /**
     * @param {string} userId
     * @returns {Promise<{monthTime: *, totalTime: *, nbSeries: *, nbSeasons: *, nbEpisodes: *, bestMonth: *}>}
     */
    getStats = async (userId) => {
        return {
            "monthTime": await this.getTimeByUserIdByType(userId, "month"),
            "totalTime": await this.getTimeByUserIdByType(userId, "total"),
            "nbSeries": await this.getCountByUserIdByType(userId, "shows"),
            "nbSeasons": await this.getCountByUserIdByType(userId, "seasons"),
            "nbEpisodes": await this.getCountByUserIdByType(userId, "episodes"),
            "bestMonth": (await this.getTimeByUserIdByType(userId, "best-month"))[0],
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} type
     * @returns Promise
     */
    getCountByUserIdByType = (currentUserId, type) => {
        switch (type) {
            case "shows":
                return this.userShowRepository.getTotalShowsByUserId(currentUserId);
            case "episodes":
                return this.userSeasonRepository.getTotalEpisodesByUserId(currentUserId);
            case "seasons":
                return this.userSeasonRepository.getTotalSeasonsByUserId(currentUserId);
            default:
                throw new Error("Requête invalide");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} type
     * @returns Promise
     */
    getTimeByUserIdByType = (currentUserId, type) => {
        switch (type) {
            case "total":
                return this.userSeasonRepository.getTotalTimeByUserId(currentUserId);
            case "years":
                return this.userSeasonRepository.getTimeHourByUserIdGroupByYear(currentUserId);
            case "month":
                return this.userSeasonRepository.getTimeCurrentMonthByUserId(currentUserId);
            case "best-month":
                return this.userSeasonRepository.getRecordViewingTimeMonth(currentUserId, 1);
            case "rank":
                return this.userSeasonRepository.getRankingViewingTimeByShows(currentUserId);
            default:
                throw new Error("Requête invalide");
        }
    }

    /**
     * @param {string} userId
     * @param {string} type
     * @param {string} period
     * @return Promise
     */
    getGroupedCountByUserIdByTypeByPeriod = (userId, type, period) => {
        switch (type) {
            case "seasons":
                return this.#getNbSeasonsByUserIdByPeriod(userId, period);
            case "episodes":
                return this.#getNbEpisodesByUserIdByPeriod(userId, period);
            case "kinds":
                return this.#getNbKindsByUserId(userId);
            case "best-months":
                return this.userSeasonRepository.getRecordViewingTimeMonth(userId);
            case "countries":
                return this.userShowRepository.getCountriesByUserId(userId);
            case "platforms":
                return this.userSeasonRepository.getPlatformsByUserId(userId);
            default:
                throw new Error("Requête invalide");
        }
    }

    /**
     * @param {string} userId
     * @return Promise<{label: string, value: number}[]>
     */
    #getNbKindsByUserId = async (userId) => {
        const kindsMap = new Map();
        const rows = await this.userShowRepository.getKindsByUserId(userId);

        rows.forEach((row) => row["kinds"]
            .split(";")
            .forEach((kind) => {
                const val = kindsMap.get(kind);
                !val ? kindsMap.set(kind, 1) : kindsMap.set(kind, val + 1);
            })
        );
        return Array
            .from(kindsMap, ([kind, occur]) => ({ "label": kind, "value": occur }))
            .sort((a, b) => b.value - a.value)
            .splice(0, 10);
    }

    /**
     * @param {string} userId
     * @param {string} period
     * @return Promise
     */
    #getNbSeasonsByUserIdByPeriod = (userId, period) => {
        switch (period) {
            case "years":
                return this.userSeasonRepository.getNbSeasonsByUserIdGroupByYear(userId);
            case "year":
                return this.userSeasonRepository.getNbSeasonsByUserIdGroupByMonthByCurrentYear(userId);
            case "months":
                return this.userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(userId);
            default:
                throw new Error("Requête invalide");
        }
    }

    /**
     * @param {string} userId
     * @param {string} period
     * @return Promise
     */
    #getNbEpisodesByUserIdByPeriod = (userId, period) => {
        switch (period) {
            case "years":
                return this.userSeasonRepository.getNbEpisodesByUserIdGroupByYear(userId);
            case "year":
                return this.userSeasonRepository.getNbEpisodesByUserIdGroupByMonthByCurrentYear(userId);
            default:
                throw new Error("Requête invalide");
        }
    }
}