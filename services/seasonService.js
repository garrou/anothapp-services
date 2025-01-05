import SeasonRepository from "../repositories/seasonRepository.js";
import Season from "../models/season.js";
import SeasonTimeline from "../models/seasonTimeline.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";

export default class SeasonService {

    constructor() {
        this.seasonRepository = new SeasonRepository();
        this.userSeasonRepository = new UserSeasonRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {number} seasonId
     * @returns {Promise<void>}
     */
    deleteBySeasonId = async (currentUserId, seasonId) => {
        if (!seasonId) {
            throw new Error("Requête invalide");
        }
        await this.seasonRepository.deleteSeasonById(currentUserId, seasonId);
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
            response = (await this.userSeasonRepository.getViewedByMonthAgo(currentUserId, month))
                .map(row => new SeasonTimeline(row));
        } else if (year) {
            response = (await this.userSeasonRepository.getSeasonsByAddedYear(currentUserId, year))
                .map(obj => new Season(obj));
        } else {
            throw new Error("Requête invalide");
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
            throw new Error("Requête invalide")
        }
        await this.seasonRepository.updateSeason(currentUserId, seasonId, platformId);
    }
}
