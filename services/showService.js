import db from "../config/db.js";
import ShowRepository from "../repositories/showRepository.js";
import UserShowRepository from "../repositories/userShowRepository.js";
import SearchService from "./searchService.js";
import EpisodeService from "./episodeService.js";
import FriendRepository from "../repositories/friendRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import SeasonRepository from "../repositories/seasonRepository.js";
import ServiceError from "../helpers/serviceError.js";
import UserListRepository from "../repositories/userListRepository.js";
import Validator from "../helpers/validator.js";
import ParserHelper from "../helpers/parser.js";
import {DUPLICATE_ERROR_CODE, ERROR_FAILED_ADD_SEASON, ERROR_INVALID_REQUEST, ERROR_NOT_FRIEND} from "../constants/errors.js";
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
            case "watchlist":
                return this._userListRepository.getListShowsByUserId(userId);
            case "finished":
                return this._userShowRepository.getShowsFinishedByUserId(userId);
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
     * @param {number} showId
     * @returns {Promise<Show|ApiShow>}
     */
    ensureShowExists = async (showId) => {
        let show = await this._showRepository.getShow(showId);

        if (!show) {
            show = await this._searchService.getByShowId(showId);

            if (!Validator.isValidShow(show)) {
                throw new ServiceError(400, "Série invalide");
            }
            const {id, title, poster, kindsById, duration, seasons, country, description, creation, network, language, episodes} = show;
            const created = await this._showRepository.createShow(
                id, title, poster, kindsById ?? [], duration, seasons, country,
                description, creation || null, network, language, episodes || null
            );

            if (!created) {
                throw new ServiceError(500, "Impossible de créer la série");
            }
        }
        return show;
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
        const show = await this.ensureShowExists(showId);
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
     * @returns {Promise<{serie: UserShow, seasons: Season[], time: number, episodes: number, distinctEpisodes: number?}>}
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
        const [time, nbEpisodes, distinctEpisodes] = await this._episodeService.getWatchedTimeAndCountByShowId(currentUserId, id);

        return {
            "serie": show,
            "seasons": seasons,
            "time": isNaN(time) ? 0 : time,
            "episodes": isNaN(nbEpisodes) ? 0 : nbEpisodes,
            distinctEpisodes,
        };
    }

    /**
     * @param {string} currentUserId
     * @param {Object} query
     * @returns {Promise<UserShow[]|Show[]>}
     */
    getShows = async (currentUserId, query) => {
        const { title, status, friendId, platforms, countries, kinds, notes, watchedWith } = query;
        if (friendId && !await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new ServiceError(400, ERROR_NOT_FRIEND);
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
            ParserHelper.splitAndToNotNull(watchedWith),
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
        await this.#ensureSeasonExists(id, num, async () => show.poster);
        const added = await this._userSeasonRepository.create(currentUserId, id, num);

        if (!added) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
    }

    /**
     * Ensures a season row exists in the shared catalog (shows/seasons tables, not a specific
     * user's viewing of it) - shared by addSeason (adding a season to a show already in the
     * collection) and ensureSeasonTracked (auto-adding a season for a friend accepting a share).
     * @param {number} showId
     * @param {number} number
     * @param {() => Promise<string>} getPosterFallback lazy - only called when the season needs
     *   creating and the API didn't return its own image
     * @returns {Promise<void>}
     */
    #ensureSeasonExists = async (showId, number, getPosterFallback) => {
        const existing = await this._seasonRepository.getSeasonByShowIdByNumber(showId, number);

        if (existing) {
            return;
        }
        const apiSeason = await this._searchService.getSeasonByShowIdByNumber(showId, number);

        if (!apiSeason) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
        const poster = apiSeason.image ?? await getPosterFallback();
        const created = await this._seasonRepository.createSeason(apiSeason.episodes, apiSeason.number, poster, showId);

        if (!created) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
    }

    /**
     * @param {string} userId
     * @param {number} showId
     * @param {number} number
     * @param {number} platformId
     * @returns {Promise<number>} the id of the existing or newly created viewing
     */
    ensureSeasonTracked = async (userId, showId, number, platformId) => {
        const existing = await this._userSeasonRepository.findAnyByUserIdShowIdNumber(userId, showId, number);

        if (existing) {
            return existing;
        }
        const hasShow = await this._userShowRepository.checkShowExistsByUserIdByShowId(userId, showId);

        if (!hasShow) {
            await this.ensureShowExists(showId);
            await this._userShowRepository.create(userId, showId);
        }
        await this.#ensureSeasonExists(showId, number, async () => (await this._showRepository.getShow(showId)).poster);

        // Two concurrent calls (e.g. a double-submitted accept) can both pass the `existing` check
        // above before either inserts - an advisory lock scoped to just this recheck-then-create
        // step (not the API calls above, so a slow BetaSeries response never holds a lock) closes
        // that window.
        const createdId = await db.transaction(async (client) => {
            await this._userSeasonRepository.lockSeasonSlot(client, userId, showId, number);
            const stillMissing = await this._userSeasonRepository.findAnyByUserIdShowIdNumber(userId, showId, number, client);

            if (stillMissing) {
                return stillMissing;
            }
            return this._userSeasonRepository.create(userId, showId, number, platformId, null, client);
        });

        if (!createdId) {
            throw new ServiceError(500, ERROR_FAILED_ADD_SEASON);
        }
        return createdId;
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
     * @returns {Promise<number>}
     */
    getSeasonWatchedTime = async (currentUserId, id, num) => {
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

            if (result) {
                eventBus.emit("show.favorited", {actorUserId: currentUserId, showId: id});
            }
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