import EpisodeRepository from "../repositories/episodeRepository.js";
import UserEpisodeRepository from "../repositories/userEpisodeRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserRepository from "../repositories/userRepository.js";
import SearchService from "./searchService.js";
import ServiceError from "../helpers/serviceError.js";
import Validator from "../helpers/validator.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";
import {MONTHS_SHORTCUTS} from "../constants/validation.js";
import mapWithConcurrency from "../schedule/lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

export default class EpisodeService {

    constructor() {
        this._episodeRepository = new EpisodeRepository();
        this._userEpisodeRepository = new UserEpisodeRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._userRepository = new UserRepository();
        this._searchService = new SearchService();
    }

    /**
     * @param {string} userId
     * @returns {Promise<void>}
     */
    #ensureTrackingEnabled = async (userId) => {
        const enabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);

        if (!enabled) {
            throw new ServiceError(400, "Le suivi des épisodes n'est pas activé");
        }
    }

    /**
     * @param {string} userId
     * @param {string} month
     * @returns {Promise<EpisodeTimeline[]>}
     */
    getViewedByMonthAgo = async (userId, month) => {
        if (!MONTHS_SHORTCUTS.includes(month)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        await this.#ensureTrackingEnabled(userId);
        return this._userEpisodeRepository.getViewedByMonthAgo(userId, month);
    }

    /**
     * @param {string} userId
     * @param {number?} showId
     * @param {number?} seasonNumber
     * @returns {Promise<number>}
     */
    getWatchedTimeByShowIdBySeasonNumber = async (userId, showId, seasonNumber) => {
        if (!showId || !seasonNumber) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return this._userEpisodeRepository.getWatchedTimeByShowIdBySeasonNumber(userId, showId, seasonNumber);
    }

    /**
     * @param {string} userId
     * @param {number?} showId
     * @returns {Promise<[number, number, number]>} watched time, count of watched episodes, count of distinct watched episodes
     */
    getWatchedTimeAndCountByShowId = async (userId, showId) => {
        if (!showId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return this._userEpisodeRepository.getWatchedTimeAndCountByShowId(userId, showId);
    }

    /**
     * @param {number} showId
     * @param {number} seasonNumber
     * @returns {Promise<Episode[]>}
     */
    #ensureEpisodesExist = async (showId, seasonNumber) => {
        const episodes = await this._episodeRepository.getEpisodesByShowIdBySeason(showId, seasonNumber);

        if (episodes.length > 0) {
            return episodes;
        }
        const apiEpisodes = await this._searchService.getEpisodesByShowIdBySeason(showId, seasonNumber);

        await Promise.all(apiEpisodes.map((episode) =>
            this._episodeRepository.upsertEpisode(
                episode.id, showId, seasonNumber, episode.number, episode.title,
                episode.code, episode.global, episode.length, episode.date
            )
        ));
        return this._episodeRepository.getEpisodesByShowIdBySeason(showId, seasonNumber);
    }

    /**
     * @param {string} userId
     * @returns {Promise<void>}
     */
    backfillForUser = async (userId) => {
        const seasons = await this._userSeasonRepository.getUserSeasonsByUserId(userId);

        await mapWithConcurrency(seasons, CONCURRENCY, async (season) => {
            const episodes = await this.#ensureEpisodesExist(season.showId, season.number);
            const aired = episodes.filter((e) => e.date && !Validator.isInFuture(e.date));

            await Promise.all(aired.map((episode) =>
                this._userEpisodeRepository.createIfMissing(userId, season.id, episode.id, season.addedAt, season.platformId)
            ));
        });
    }

    /**
     * @param {string} userId
     * @param {number?} userSeasonId
     * @returns {Promise<UserEpisode[]>}
     */
    getByUserSeasonId = async (userId, userSeasonId) => {
        if (!userSeasonId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        await this.#ensureTrackingEnabled(userId);
        const season = await this._userSeasonRepository.getOwnedSeasonViewing(userId, userSeasonId);

        if (!season) {
            throw new ServiceError(400, "Ce visionnage n'est pas dans votre collection");
        }
        await this.#ensureEpisodesExist(season.showId, season.number);
        return this._userEpisodeRepository.getByUserSeasonId(userSeasonId, season.showId, season.number);
    }

    /**
     * @param {string} userId
     * @param {number?} userSeasonId
     * @param {number?} episodeId
     * @returns {Promise<void>}
     */
    addViewing = async (userId, userSeasonId, episodeId) => {
        if (!userSeasonId || !episodeId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        await this.#ensureTrackingEnabled(userId);
        const season = await this._userSeasonRepository.getOwnedSeasonViewing(userId, userSeasonId);

        if (!season) {
            throw new ServiceError(400, "Ce visionnage n'est pas dans votre collection");
        }
        const episode = await this._episodeRepository.getEpisodeById(episodeId);

        if (!episode || episode.showId !== season.showId || episode.seasonNumber !== season.number) {
            throw new ServiceError(400, "Cet épisode ne fait pas partie de cette saison");
        }
        if (!episode.date || Validator.isInFuture(episode.date)) {
            throw new ServiceError(400, "Cet épisode n'est pas encore diffusé");
        }
        const exists = await this._userEpisodeRepository.existsForViewing(userSeasonId, episodeId);

        if (exists) {
            throw new ServiceError(409, "Cet épisode a déjà été visionné pour ce visionnage");
        }
        const created = await this._userEpisodeRepository.create(
            userId, userSeasonId, episodeId, new Date().toISOString(), season.platformId
        );

        if (!created) {
            throw new ServiceError(500, "Impossible d'ajouter le visionnage");
        }
    }

    /**
     * @param {string} userId
     * @param {number?} id
     * @param {string?} watchedAt
     * @returns {Promise<void>}
     */
    updateViewing = async (userId, id, watchedAt) => {
        if (!id || !watchedAt) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        if (Validator.isInFuture(watchedAt)) {
            throw new ServiceError(400, "Date de visionnage invalide");
        }
        const updated = await this._userEpisodeRepository.updateWatchedAt(userId, id, watchedAt);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier le visionnage");
        }
    }

    /**
     * @param {string} userId
     * @param {number} userSeasonId
     * @param {number} platformId
     * @returns {Promise<void>}
     */
    updatePlatformForSeason = async (userId, userSeasonId, platformId) => {
        const enabled = await this._userRepository.hasEpisodeTrackingEnabled(userId);

        if (!enabled) {
            return;
        }
        await this._userEpisodeRepository.updatePlatformByUserSeasonId(userSeasonId, platformId);
    }

    /**
     * @param {string} userId
     * @param {number?} id
     * @returns {Promise<void>}
     */
    deleteViewing = async (userId, id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const deleted = await this._userEpisodeRepository.deleteById(userId, id);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer le visionnage");
        }
    }
}
