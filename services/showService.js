import Season from "../models/season.js";
import Show from "../models/show.js";
import {idValidShow} from "../helpers/validator.js";
import {cumulate} from "../helpers/utils.js";
import UserSeason from "../models/userSeason.js";
import ShowRepository from "../repositories/showRepository.js";
import UserShowRepository from "../repositories/userShowRepository.js";
import SearchService from "./searchService.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import SeasonRepository from "../repositories/seasonRepository.js";

export default class ShowService {

    constructor() {
        this.showRepository = new ShowRepository();
        this.userShowRepository = new UserShowRepository();
        this.userSeasonRepository = new UserSeasonRepository();
        this.searchService = new SearchService();
        this.friendRepository = new FriendRepository();
        this.seasonRepository = new SeasonRepository();
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {string?} friendId
     * @returns Promise<any>
     */
    #getShowsByStatus = async (userId, status, friendId) => {
        switch (status) {
            case "resume":
                return this.userShowRepository.getShowsToResumeByUserId(userId);
            case "not-started":
                return this.userShowRepository.getNotStartedShowsByUserId(userId);
            case "continue":
                return this.userShowRepository.getShowsToContinueByUserId(userId);
            case "favorite":
                return this.userShowRepository.getFavoritesByUserId(friendId ?? userId);
            case "shared":
                if (!friendId) {
                    throw new Error("Requête invalide");
                }
                return this.userShowRepository.getSharedShowsWithFriend(userId, friendId);
            default:
                throw new Error("Requête invalide");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {boolean} addInList
     * @returns {Promise<void>}
     */
    addShow = async (currentUserId, id, addInList = false) => {

        if (!id) {
            throw new Error("Requête invalide");
        }
        const exists = await this.userShowRepository.checkShowExistsByUserIdByShowId(currentUserId, id, addInList);

        if (exists) {
            throw new Error(`Cette série est déjà dans votre ${addInList ? "liste" : "collection"}`);
        }
        const isNewShow = await this.showRepository.isNewShow(id);

        if (isNewShow) {
            const show = await this.searchService.getByShowId(id);

            if (!idValidShow(show)) {
                throw new Error("Série invalide");
            }
            const {id, title, poster, kinds, duration, seasons, country} = show;
            await this.showRepository.createShow(id, title, poster, kinds.join(";"), duration, seasons, country);
        }
        await this.userShowRepository.create(currentUserId, id, addInList);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {string} inList
     * @returns {Promise<void>}
     */
    deleteByShowId = async (currentUserId, id, inList) => {
        const deleteInList = (/true/i).test(inList);

        if (!id) {
            throw new Error("Requête invalide");
        }
        await this.userShowRepository.deleteByUserIdShowId(currentUserId, id, deleteInList);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @returns {Promise<{seasons: Season[], time: number, episodes: number}>}
     */
    getShowById = async (currentUserId, id) => {
        if (!id) {
            throw new Error("Requête invalide");
        }
        // const show = await this.userShowRepository.getShowByUserIdByShowId(currentUserId, id);

        // if (!show) {
        //     throw new Error("Série introuvable");
        // }
        const seasons = await this.userSeasonRepository.getDistinctByUserIdByShowId(currentUserId, id);
        const [time, nbEpisodes] = await this.userSeasonRepository.getTimeEpisodesByUserIdByShowId(currentUserId, id);
        const episodes = cumulate(seasons);
        const mapSeasons = seasons.map((s, i) => new Season(s, `${episodes[i] + 1} - ${episodes[i + 1]}`));
        return {
            // "serie": new Show(show),
            "seasons": mapSeasons,
            "time": time,
            "episodes": nbEpisodes
        };
    }

    /**
     * @param {string} currentUserId
     * @param title
     * @param limit
     * @param status
     * @param friendId
     * @param platforms
     * @returns {Promise<Show[]>}
     */
    getShows = async (currentUserId, title, limit, status, friendId, platforms) => {
        let rows = null;

        if (friendId && !await this.friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new Error("Vous n'êtes pas en relation avec cette personne");
        }
        if (title) {
            rows = await this.userShowRepository.getShowsByUserIdByTitle(currentUserId, title);
        } else if (status) {
            rows = await this.#getShowsByStatus(currentUserId, status, friendId);
        } else if (platforms) {
            const ids = platforms.split(",").map((p) => parseInt(p));
            rows = await this.userShowRepository.getShowsByUserIdByPlatforms(currentUserId, ids);
        } else {
            rows = await this.userShowRepository.getShowsByUserId(currentUserId, limit);
        }
        return rows.map((row) => new Show(row));
    }

    /**
     * @param {string} currentUserId
     * @param {any} serie
     * @param {any} season
     * @returns {Promise<void>}
     */
    addSeasonByShowId = async (currentUserId, serie, season) => {
        if (!serie || !serie.id || !season || !season.number || !season.episodes) {
            throw new Error("Requête invalide");
        }
        const rows = await this.seasonRepository.getSeasonByShowIdByNumber(serie.id, season.number);

        if (rows.length === 0) {
            await this.seasonRepository.createSeason(season.episodes, season.number, season.image ?? serie.poster, serie.id);
        }
        await this.userSeasonRepository.create(currentUserId, serie.id, season.number);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<UserSeason[]>}
     */
    getSeasonInfosByShowIdBySeason = async (currentUserId, id, num) => {
        if (!id || !num) {
            throw new Error("Requête invalide");
        }
        const rows = await this.userSeasonRepository.getInfosByUserIdByShowId(currentUserId, id, num);
        // const time = await userSeasonRepository.getViewingTimeByUserIdByShowIdByNumber(currentUserId, id, num);
        return rows.map(row => new UserSeason(row));
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {boolean?} favorite
     * @param {boolean?} watch
     * @returns {Promise<boolean|null>}
     */
    updateByShowId = async (currentUserId, id, favorite, watch) => {
        let result = null;

        if (!id || (!favorite && !watch)) {
            throw new Error("Requête invalide");
        } else if (favorite) {
            result = await this.userShowRepository.updateFavoriteByUserIdByShowId(currentUserId, id);
        } else if (watch) {
            result = await this.userShowRepository.updateWatchingByUserIdByShowId(currentUserId, id);
        }
        return result;
    }
}