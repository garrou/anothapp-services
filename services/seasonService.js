import SeasonRepository from "../repositories/seasonRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import ServiceError from "../helpers/serviceError.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";

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
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const deleted = await this._seasonRepository.deleteSeasonById(currentUserId, seasonId);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer la saison");
        }
    }

    /**
     * @param currentUserId
     * @param year
     * @param month
     * @returns {Promise<SeasonTimeline[] | Season[]>}
     */
    getSeasons = async (currentUserId, year, month) => {
        const MONTHS = ["0", "1", "2", "3", "6", "12", "60"];

        if (MONTHS.includes(month)) {
            return await this._userSeasonRepository.getViewedByMonthAgo(currentUserId, month);
        } else if (year) {
            return await this._userSeasonRepository.getSeasonsByAddedYear(currentUserId, year);
        }
        throw new ServiceError(400, ERROR_INVALID_REQUEST);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} seasonId
     * @param {number?} platformId
     * @param {string?} viewedAt
     * @returns {Promise<void>}
     */
    updateBySeasonId = async (currentUserId, seasonId, platformId, viewedAt) => {
        if (!seasonId || !platformId || !viewedAt) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST)
        }
        const updated = await this._seasonRepository.updateSeason(currentUserId, seasonId, platformId, viewedAt);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier la saison");
        }
    }
}
