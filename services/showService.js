import ShowRepository from "../repositories/showRepository.js";
import UserShowRepository from "../repositories/userShowRepository.js";
import SearchService from "./searchService.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import SeasonRepository from "../repositories/seasonRepository.js";
import EpisodeRepository from "../repositories/episodeRepository.js";
import UserEpisodeRepository from "../repositories/userEpisodeRepository.js";
import ServiceError from "../helpers/serviceError.js";
import Validator from "../helpers/validator.js";
import ParserHelper from "../helpers/parser.js";
import {ERROR_FAILED_ADD_SEASON, ERROR_FAILED_ADD_EPISODE, ERROR_INVALID_REQUEST} from "../constants/errors.js";

export default class ShowService {

    constructor() {
        this._showRepository = new ShowRepository();
        this._userShowRepository = new UserShowRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._searchService = new SearchService();
        this._friendRepository = new FriendRepository();
        this._seasonRepository = new SeasonRepository();
        this._episodeRepository = new EpisodeRepository();
        this._userEpisodeRepository = new UserEpisodeRepository();
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {string?} friendId
     * @returns {Promise<UserShow[]|Show[]>}
     */
    #getShowsByStatus = async (userId, status, friendId) => {
        switch (status) {
            case "stopped":
                return this._userShowRepository.getShowsToResumeByUserId(userId);
            case "continue":
                return this._userShowRepository.getShowsToContinueByUserId(userId);
            case "favorite":
                return this._userShowRepository.getFavoritesByUserId(friendId ?? userId);
            case "next":
                return this._userShowRepository.getShowsWithNextEpisode(userId);
            case "shared":
                if (!friendId) {
                    throw new ServiceError(400, ERROR_INVALID_REQUEST);
                }
                return this._userShowRepository.getSharedShowsWithFriend(userId, friendId);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} showId
     * @returns {Promise<Show|ApiShow>}
     */
    addShow = async (currentUserId, showId) => {
        if (!showId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const exists = await this._userShowRepository.checkShowExistsByUserIdByShowId(currentUserId, showId);

        if (exists) {
            throw new ServiceError(409, "Cette série est déjà dans votre collection");
        }
        let show = await this._showRepository.getShow(showId);

        if (!show) {
            show = await this._searchService.getByShowId(showId);

            if (!Validator.isValidShow(show)) {
                throw new ServiceError(400, "Série invalide");
            }
            const {id, title, poster, kinds, duration, seasons, country} = show;
            const created = await this._showRepository.createShow(id, title, poster, kinds.join(";"), duration, seasons, country);

            if (!created) {
                throw new ServiceError(500, "Impossible de créer la série");
            }
        }
        const added = await this._userShowRepository.create(currentUserId, showId);

        if (!added) {
            throw new ServiceError(500, "Impossible d'ajouter la série");
        }
        return show;
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @returns {Promise<void>}
     */
    deleteByShowId = async (currentUserId, id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const deleted = await this._userShowRepository.deleteByUserIdShowId(currentUserId, id);

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
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const show = await this._userShowRepository.getShowByUserIdByShowId(currentUserId, id);

        if (!show) {
            throw new ServiceError(404, "Série introuvable");
        }
        const seasons = await this._userSeasonRepository.getDistinctByUserIdByShowId(currentUserId, id);
        const [time, nbEpisodes] = await this._userSeasonRepository.getTimeEpisodesByUserIdByShowId(currentUserId, id);
        return {
            "serie": show,
            "seasons": seasons,
            "time": isNaN(time) ? 0 : time,
            "episodes": isNaN(nbEpisodes) ? 0 : nbEpisodes
        };
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
        const existingSeason = await this._seasonRepository.getSeasonByShowIdByNumber(id, num);

        if (existingSeason) {
            await this.#populateEpisodes(id, num);
            const added = await this._userSeasonRepository.create(currentUserId, id, num);

            if (!added) {
                throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
            }
            return;
        }
        const season = await this._searchService.getSeasonByShowIdByNumber(id, num);

        if (!season) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
        const created = await this._seasonRepository.createSeason(season.episodes, season.number, season.image ?? show.poster, id);

        if (!created) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
        await this.#populateEpisodes(id, num);
        const added = await this._userSeasonRepository.create(currentUserId, id, num);

        if (!added) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
    }

    /**
     * Best-effort population of the episodes table when a season is added.
     * Never blocks addSeason: watching episode by episode stays optional.
     * @param {number} showId
     * @param {number} num
     * @returns {Promise<void>}
     */
    #populateEpisodes = async (showId, num) => {
        try {
            const hasEpisodes = await this._episodeRepository.hasEpisodesByShowIdBySeason(showId, num);

            if (hasEpisodes) {
                return;
            }
            const episodes = await this._searchService.getEpisodesByShowIdBySeason(showId, num);

            await Promise.all(episodes.map((episode) => this._episodeRepository.createEpisode(
                episode.id, episode.title, episode.number, episode.season,
                episode.code, episode.global, episode.length, episode.date, showId
            )));
        } catch (e) {
            console.error("Impossible de récupérer les épisodes de la saison", showId, num, e);
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {number?} episodeId
     * @returns {Promise<void>}
     */
    addEpisode = async (currentUserId, id, episodeId) => {
        if (!id || !episodeId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const show = await this._userShowRepository.getShowByUserIdByShowId(currentUserId, id);

        if (!show) {
            throw new ServiceError(400, "Cette série n'est pas dans votre collection");
        }
        const episode = await this._episodeRepository.getEpisodeById(episodeId);

        if (!episode || episode.showId !== Number(id)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const added = await this._userEpisodeRepository.create(currentUserId, episodeId);

        if (!added) {
            throw new ServiceError(500, ERROR_FAILED_ADD_EPISODE);
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {number?} num
     * @returns {Promise<UserEpisode[]>}
     */
    getEpisodesByShowIdBySeason = async (currentUserId, id, num) => {
        if (!id || !num) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return this._episodeRepository.getEpisodesWithWatchedStatus(currentUserId, id, num);
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
     * @param {number?} episodeId
     * @returns {Promise<PartialUserEpisode[]>}
     */
    getEpisodeInfosByShowIdByEpisode = async (currentUserId, id, episodeId) => {
        if (!id || !episodeId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return await this._userEpisodeRepository.getViewingsByUserIdByEpisodeId(currentUserId, episodeId);
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
        } else {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return result;
    }
}