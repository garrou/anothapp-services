import ShowRepository from "../repositories/showRepository.js";
import UserShowRepository from "../repositories/userShowRepository.js";
import SearchService from "./searchService.js";
import EpisodeService from "./episodeService.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import SeasonRepository from "../repositories/seasonRepository.js";
import UserRepository from "../repositories/userRepository.js";
import ServiceError from "../helpers/serviceError.js";
import UserListRepository from "../repositories/userListRepository.js";
import Validator from "../helpers/validator.js";
import ParserHelper from "../helpers/parser.js";
import {DUPLICATE_ERROR_CODE, ERROR_FAILED_ADD_SEASON, ERROR_INVALID_REQUEST} from "../constants/errors.js";
import eventBus from "../helpers/eventBus.js";

export default class ShowService {

    constructor() {
        this._showRepository = new ShowRepository();
        this._userShowRepository = new UserShowRepository();
        this._userListRepository = new UserListRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._searchService = new SearchService();
        this._episodeService = new EpisodeService();
        this._friendRepository = new FriendRepository();
        this._seasonRepository = new SeasonRepository();
        this._userRepository = new UserRepository();
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {string?} friendId
     * @returns {Promise<UserShow[]|Show[]>}
     */
    #getShowsByStatus = async (userId, status, friendId) => {
        switch (status) {
            case "stopped": {
                const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);
                return episodeTrackingEnabled
                    ? this._userShowRepository.getShowsToResumeByUserIdEpisodes(userId)
                    : this._userShowRepository.getShowsToResumeByUserId(userId);
            }
            case "watchlist":
                return this._userListRepository.getListShowsByUserId(userId);
            case "finished": {
                const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);
                return episodeTrackingEnabled
                    ? this._userShowRepository.getShowsFinishedByUserIdEpisodes(userId)
                    : this._userShowRepository.getShowsFinishedByUserId(userId);
            }
            case "continue": {
                const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);
                return episodeTrackingEnabled
                    ? this._userShowRepository.getShowsToContinueByUserIdEpisodes(userId)
                    : this._userShowRepository.getShowsToContinueByUserId(userId);
            }
            case "favorite":
                return this._userShowRepository.getFavoritesByUserId(friendId ?? userId);
            case "next":
                return this._userShowRepository.getShowsWithNextEpisode(userId);
            case "shared":
                if (!friendId) {
                    throw new ServiceError(400, ERROR_INVALID_REQUEST);
                }
                return this._userShowRepository.getSharedShowsWithFriend(userId, friendId);
            case "all":
                if (!friendId) {
                    throw new ServiceError(400, ERROR_INVALID_REQUEST);
                }
                return this._userShowRepository.getShowsByUserId(friendId, undefined, [], [], [], []);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} showId
     * @param {boolean} addInList
     * @returns {Promise<Show|ApiShow>}
     */
    addShow = async (currentUserId, showId, addInList = false) => {
        if (!showId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const exists = addInList
            ? await this._userListRepository.checkShowExistsByUserIdByShowId(currentUserId, showId)
            : await this._userShowRepository.checkShowExistsByUserIdByShowId(currentUserId, showId);

        if (exists) {
            throw new ServiceError(409, `Cette série est déjà dans votre ${addInList ? "liste" : "collection"}`);
        }
        let show = await this._showRepository.getShow(showId);

        if (!show) {
            show = await this._searchService.getByShowId(showId);

            if (!Validator.isValidShow(show)) {      
                throw new ServiceError(400, "Série invalide");
            }
            const {id, title, poster, kinds, duration, seasons, country, description, creation, network, language, episodes} = show;
            const created = await this._showRepository.createShow(
                id, title, poster, kinds.join(";"), duration, seasons, country,
                description, creation || null, network, language, episodes || null
            );

            if (!created) {
                throw new ServiceError(500, "Impossible de créer la série");
            }
        }
        let added;
        try {
            added = addInList
                ? await this._userListRepository.create(currentUserId, showId)
                : await this._userShowRepository.create(currentUserId, showId);
        } catch (err) {
            if (err.code === DUPLICATE_ERROR_CODE) {
                throw new ServiceError(409, `Cette série est déjà dans votre ${addInList ? "liste" : "collection"}`);
            }
            throw err;
        }
        if (!added) {
            throw new ServiceError(500, "Impossible d'ajouter la série");
        }
        if (!addInList) {
            eventBus.emit("show.started", {actorUserId: currentUserId, showId});
        }
        return show;
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
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
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
     * @returns {Promise<{seasons: Season[], time: number, episodes: number, distinctEpisodes: number?}>}
     */
    getShowById = async (currentUserId, id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        // const show = await this._userShowRepository.getShowByUserIdByShowId(currentUserId, id);

        // if (!show) {
        //     throw new Error("Série introuvable");
        // }
        const seasons = await this._userSeasonRepository.getDistinctByUserIdByShowId(currentUserId, id);
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(currentUserId);
        let time, nbEpisodes, distinctEpisodes;

        if (episodeTrackingEnabled) {
            [time, nbEpisodes, distinctEpisodes] = await this._episodeService.getWatchedTimeAndCountByShowId(currentUserId, id);
        } else {
            [time, nbEpisodes] = await this._userSeasonRepository.getTimeEpisodesByUserIdByShowId(currentUserId, id);
        }
        const result = {
            // "serie": new UserShow(show),
            "seasons": seasons,
            "time": isNaN(time) ? 0 : time,
            "episodes": isNaN(nbEpisodes) ? 0 : nbEpisodes
        };
        if (episodeTrackingEnabled) {
            result.distinctEpisodes = distinctEpisodes;
        }
        return result;
    }

    /**
     * @param {string} currentUserId
     * @param {Object} query
     * @returns {Promise<UserShow[]|Show[]>}
     */
    getShows = async (currentUserId, query) => {
        const { title, status, friendId, platforms, countries, kinds, notes } = query;
        if (friendId && !await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new ServiceError(400, "Vous n'êtes pas en relation avec cette personne");
        }
        if (status) {
            return this.#getShowsByStatus(currentUserId, status, friendId);
        }
        return this._userShowRepository.getShowsByUserId(
            currentUserId,
            title,
            ParserHelper.splitAndToNumber(platforms),
            ParserHelper.splitAndToNotNull(countries),
            ParserHelper.splitAndToNotNull(kinds),
            ParserHelper.splitAndToNumber(notes),
        );
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<void>}
     */
    addSeason = async (currentUserId, id, num) => {
        if (!id || !num) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const show = await this._userShowRepository.getShowByUserIdByShowId(currentUserId, id);

        if (!show) {
            throw new ServiceError(400, "Cette série n'est pas dans votre collection");
        }
        let existingSeason = await this._seasonRepository.getSeasonByShowIdByNumber(id, num);

        if (!existingSeason) {
            const season = await this._searchService.getSeasonByShowIdByNumber(id, num);

            if (!season) {
                throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
            }
            const created = await this._seasonRepository.createSeason(season.episodes, season.number, season.image ?? show.poster, id);

            if (!created) {
                throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
            }
            existingSeason = season;
        }
        const added = await this._userSeasonRepository.create(currentUserId, id, num);

        if (!added) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(currentUserId);

        if (!episodeTrackingEnabled) {
            eventBus.emit("season.watched", {actorUserId: currentUserId, showId: id, metadata: {seasonNumber: num}});
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
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        // const time = await userSeasonRepository.getViewingTimeByUserIdByShowIdByNumber(currentUserId, id, num);
        return await this._userSeasonRepository.getInfosByUserIdByShowId(currentUserId, id, num);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<number|null>} null when the user doesn't track episodes - caller should fall back to the season-level estimate
     */
    getSeasonWatchedTime = async (currentUserId, id, num) => {
        const episodeTrackingEnabled = await this._userRepository.hasEpisodeTrackingEnabled(currentUserId);

        if (!episodeTrackingEnabled) {
            return null;
        }
        return this._episodeService.getWatchedTimeByShowIdBySeasonNumber(currentUserId, id, num);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {Object} body
     * @returns {Promise<boolean>}
     */
    updateByShowId = async (currentUserId, id, body) => {
        let result = null;
        const {favorite, watch, addedAt, note} = body;

        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        if (favorite) {
            result = await this._userShowRepository.updateFavoriteByUserIdByShowId(currentUserId, id);
        } else if (watch) {
            result = await this._userShowRepository.updateWatchingByUserIdByShowId(currentUserId, id);
        } else if (addedAt) {
            if (Validator.isInFuture(addedAt)) {
                throw new ServiceError(400, "Date invalide");
            }
            result = await this._userShowRepository.updateAddedAtByUserIdByShowId(currentUserId, id, addedAt);
        } else if (note) {
            result = await this._userShowRepository.updateNoteByUserIdByShowId(currentUserId, id, note);

            if (result) {
                eventBus.emit("show.rated", {actorUserId: currentUserId, showId: id, metadata: {noteId: note}});
            }
        } else {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return result;
    }

    /**
     * @param {string} currentUserId
     * @returns {Promise<Recommendation[]>}
     */
    getRecommendations = async (currentUserId) => {
        return this._userShowRepository.getRecommendationsByUserId(currentUserId);
    }
}