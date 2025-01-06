import SeasonRepository from "../repositories/seasonRepository.js";
import Season from "../models/season.js";
import SeasonTimeline from "../models/seasonTimeline.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import ServiceError from "../models/serviceError.js";

export default class SeasonService {

    constructor() {
        this._seasonRepository = new SeasonRepository();
        this._userSeasonRepository = new UserSeasonRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {number} seasonId
     * @returns {Promise<void>}
     */
    deleteBySeasonId = async (currentUserId, seasonId) => {
        if (!seasonId) {
            throw new ServiceError(400, "Requête invalide");
        }
        await this._seasonRepository.deleteSeasonById(currentUserId, seasonId);
    }

    /**
     * @param currentUserId
     * @param year
     * @param month
     * @returns {Promise<SeasonTimeline[] | Season[]>}
     */
    getSeasons = async (currentUserId, year, month) => {
        const MONTHS = ["0", "1", "2", "3", "6", "12", "60"];
        let response = null;

        if (MONTHS.includes(month)) {
            response = (await this._userSeasonRepository.getViewedByMonthAgo(currentUserId, month))
                .map(row => new SeasonTimeline(row));
        } else if (year) {
            response = (await this._userSeasonRepository.getSeasonsByAddedYear(currentUserId, year))
                .map(obj => new Season(obj));
        } else {
            throw new ServiceError(400, "Requête invalide");
        }
        return response;
    }

    /**
     * @param {string} currentUserId
     * @param {number?} seasonId
     * @param {number} platformId
     * @returns {Promise<void>}
     */
    updateBySeasonId = async (currentUserId, seasonId, platformId) => {
        if (!seasonId) {
            throw new ServiceError(400, "Requête invalide")
        }
        await this._seasonRepository.updateSeason(currentUserId, seasonId, platformId);
    }
}
