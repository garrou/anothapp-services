import UserShowRepository from "../repositories/userShowRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import ServiceError from "../helpers/serviceError.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";

export default class StatService {
    constructor() {
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
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
            "bestMonth": await this.getTimeByUserIdByType(userId, "best-month"),
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} type
     * @returns {Promise<number>}
     */
    getCountByUserIdByType = (currentUserId, type) => {
        switch (type) {
            case "shows":
                return this._userShowRepository.getTotalShowsByUserId(currentUserId);
            case "episodes":
                return this._userSeasonRepository.getTotalEpisodesByUserId(currentUserId);
            case "seasons":
                return this._userSeasonRepository.getTotalSeasonsByUserId(currentUserId);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} type
     * @returns {Promise<any>}
     */
    getTimeByUserIdByType = (currentUserId, type) => {
        switch (type) {
            case "total":
                return this._userSeasonRepository.getTotalTimeByUserId(currentUserId);
            case "years":
                return this._userSeasonRepository.getTimeHourByUserIdGroupByYear(currentUserId);
            case "month":
                return this._userSeasonRepository.getTimeCurrentMonthByUserId(currentUserId);
            case "best-month":
                return this._userSeasonRepository.getRecordViewingTimeMonth(currentUserId, 1);
            case "rank":
                return this._userSeasonRepository.getRankingViewingTimeByShows(currentUserId);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
    }

    /**
     * @param {string} userId
     * @param {string} type
     * @param {string} period
     * @param {number?} limit
     * @return Promise
     */
    getGroupedCountByUserIdByTypeByPeriod = (userId, type, period, limit) => {
        switch (type) {
            case "seasons":
                return this.#getNbSeasonsByUserIdByPeriod(userId, period);
            case "episodes":
                return this.#getNbEpisodesByUserIdByPeriod(userId, period);
            case "kinds":
                return this.#getNbKindsByUserId(userId);
            case "best-months":
                return this._userSeasonRepository.getRecordViewingTimeMonth(userId, limit);
            case "countries":
                return this._userShowRepository.getCountriesByUserId(userId, limit);
            case "platforms":
                return this._userSeasonRepository.getPlatformsByUserId(userId, limit);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
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
                return this._userSeasonRepository.getNbSeasonsByUserIdGroupByYear(userId);
            case "year":
                return this._userSeasonRepository.getNbSeasonsByUserIdGroupByMonthByCurrentYear(userId);
            case "months":
                return this._userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(userId);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
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
                return this._userSeasonRepository.getNbEpisodesByUserIdGroupByYear(userId);
            case "year":
                return this._userSeasonRepository.getNbEpisodesByUserIdGroupByMonthByCurrentYear(userId);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
    }
}