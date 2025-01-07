import Season from "../models/season.js";
import Show from "../models/show.js";
import {cumulate} from "../helpers/utils.js";
import UserSeason from "../models/userSeason.js";
import ShowRepository from "../repositories/showRepository.js";
import UserShowRepository from "../repositories/userShowRepository.js";
import SearchService from "./searchService.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import SeasonRepository from "../repositories/seasonRepository.js";
import ServiceError from "../helpers/serviceError.js";
import UserListRepository from "../repositories/userListRepository.js";
import Validator from "../helpers/validator.js";

export default class ShowService {

    constructor() {
        this._showRepository = new ShowRepository();
        this._userShowRepository = new UserShowRepository();
        this._userListRepository = new UserListRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this.searchService = new SearchService();
        this._friendRepository = new FriendRepository();
        this._seasonRepository = new SeasonRepository();
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {string?} friendId
     * @returns {Promise<any>}
     */
    _getShowsByStatus = async (userId, status, friendId) => {
        switch (status) {
            case "resume":
                return this._userShowRepository.getShowsToResumeByUserId(userId);
            case "not-started":
                return this._userListRepository.getNotStartedShowsByUserId(userId);
            case "continue":
                return this._userShowRepository.getShowsToContinueByUserId(userId);
            case "favorite":
                return this._userShowRepository.getFavoritesByUserId(friendId ?? userId);
            case "shared":
                if (!friendId) {
                    throw new ServiceError(400, "Requête invalide");
                }
                return this._userShowRepository.getSharedShowsWithFriend(userId, friendId);
            default:
                throw new ServiceError(400, "Requête invalide");
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
            throw new ServiceError(400, "Requite invalide");
        }
        const exists = addInList
            ? await this._userListRepository.checkShowExistsByUserIdByShowId(currentUserId, id)
            : await this._userShowRepository.checkShowExistsByUserIdByShowId(currentUserId, id);

        if (exists) {
            throw new ServiceError(409, `Cette série est déjà dans votre ${addInList ? "liste" : "collection"}`);
        }
        const isNewShow = await this._showRepository.isNewShow(id);

        if (isNewShow) {
            const show = await this.searchService.getByShowId(id);

            if (!Validator.idValidShow(show)) {
                throw new ServiceError(400, "Série invalide");
            }
            const {id, title, poster, kinds, duration, seasons, country} = show;
            const created = await this._showRepository.createShow(id, title, poster, kinds.join(";"), duration, seasons, country);

            if (!created) {
                throw new ServiceError(500, "Impossible de créer la série");
            }
        }
        if (addInList) {
            await this._userListRepository.create(currentUserId, id);
        } else {
            await this._userShowRepository.create(currentUserId, id);
        }
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
            throw new ServiceError(400, "Requête invalide");
        }
        const deleted = deleteInList
            ? await this._userListRepository.deleteByUserIdShowId(currentUserId, id)
            : await this._userShowRepository.deleteByUserIdShowId(currentUserId, id);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer la série");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @returns {Promise<{seasons: Season[], time: number, episodes: number}>}
     */
    getShowById = async (currentUserId, id) => {
        if (!id) {
            throw new ServiceError(400, "Requête invalide");
        }
        // const show = await this._userShowRepository.getShowByUserIdByShowId(currentUserId, id);

        // if (!show) {
        //     throw new Error("Série introuvable");
        // }
        const seasons = await this._userSeasonRepository.getDistinctByUserIdByShowId(currentUserId, id);
        const [time, nbEpisodes] = await this._userSeasonRepository.getTimeEpisodesByUserIdByShowId(currentUserId, id);
        const episodes = cumulate(seasons, "episodes");
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

        if (friendId && !await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new ServiceError(400, "Vous n'êtes pas en relation avec cette personne");
        }
        if (title) {
            rows = await this._userShowRepository.getShowsByUserIdByTitle(currentUserId, title);
        } else if (status) {
            rows = await this._getShowsByStatus(currentUserId, status, friendId);
        } else if (platforms) {
            const ids = platforms.split(",").map((p) => parseInt(p));
            rows = await this._userShowRepository.getShowsByUserIdByPlatforms(currentUserId, ids);
        } else {
            rows = await this._userShowRepository.getShowsByUserId(currentUserId, limit);
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
            throw new ServiceError(400, "Requête invalide");
        }
        const rows = await this._seasonRepository.getSeasonByShowIdByNumber(serie.id, season.number);

        if (rows.length === 0) {
            await this._seasonRepository.createSeason(season.episodes, season.number, season.image ?? serie.poster, serie.id);
        }
        const added = await this._userSeasonRepository.create(currentUserId, serie.id, season.number);

        if (!added) {
            throw new ServiceError(500, "Impossible d'ajouter la saison");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<UserSeason[]>}
     */
    getSeasonInfosByShowIdBySeason = async (currentUserId, id, num) => {
        if (!id || !num) {
            throw new ServiceError(400, "Requête invalide");
        }
        const rows = await this._userSeasonRepository.getInfosByUserIdByShowId(currentUserId, id, num);
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
            throw new ServiceError(400, "Requête invalide");
        } else if (favorite) {
            result = await this._userShowRepository.updateFavoriteByUserIdByShowId(currentUserId, id);
        } else if (watch) {
            result = await this._userShowRepository.updateWatchingByUserIdByShowId(currentUserId, id);
        }
        return result;
    }
}