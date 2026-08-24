import EpisodeRepository from "../repositories/episodeRepository.js";
import UserEpisodeRepository from "../repositories/userEpisodeRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import SearchService from "./searchService.js";
import ServiceError from "../helpers/serviceError.js";
import Validator from "../helpers/validator.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";
import mapWithConcurrency from "../schedule/lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

export default class EpisodeService {

    constructor() {
        this._episodeRepository = new EpisodeRepository();
        this._userEpisodeRepository = new UserEpisodeRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._searchService = new SearchService();
    }

    /**
     * Ensures the show/season's episodes are synced locally, fetching them from
     * BetaSeries the first time they're needed.
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

        for (const episode of apiEpisodes) {
            await this._episodeRepository.upsertEpisode(
                episode.id, showId, seasonNumber, episode.number, episode.title,
                episode.code, episode.global, episode.length, episode.date
            );
        }
        return this._episodeRepository.getEpisodesByShowIdBySeason(showId, seasonNumber);
    }

    /**
     * Creates the per-episode checklist for a user when a season is added while
     * episode tracking is enabled.
     * @param {string} userId
     * @param {number} showId
     * @param {number} seasonNumber
     * @returns {Promise<void>}
     */
    trackSeason = async (userId, showId, seasonNumber) => {
        const episodes = await this.#ensureEpisodesExist(showId, seasonNumber);
        await this._userEpisodeRepository.createPlaceholders(userId, episodes.map((e) => e.id));
    }

    /**
     * Marks every season a user already tracks as watched at the episode level too,
     * using each viewing's added_at date as a best-effort watch date - a season
     * rewatched N times backfills N watched rows per episode, not just one. Idempotent.
     * @param {string} userId
     * @returns {Promise<void>}
     */
    backfillForUser = async (userId) => {
        const seasons = await this._userSeasonRepository.getUserSeasonsByUserId(userId);
        const groups = new Map();

        for (const season of seasons) {
            const key = `${season.showId}:${season.number}`;

            if (!groups.has(key)) {
                groups.set(key, {showId: season.showId, number: season.number, watchedDates: []});
            }
            groups.get(key).watchedDates.push(season.addedAt);
        }

        await mapWithConcurrency([...groups.values()], CONCURRENCY, async (group) => {
            const episodes = await this.#ensureEpisodesExist(group.showId, group.number);
            const watchedDates = group.watchedDates.sort();

            for (const episode of episodes) {
                await this._userEpisodeRepository.topUpWatched(userId, episode.id, watchedDates);
            }
        });
    }

    /**
     * @param {string} userId
     * @param {number?} showId
     * @param {number?} seasonNumber
     * @returns {Promise<UserEpisode[]>}
     */
    getBySeasonForUser = async (userId, showId, seasonNumber) => {
        if (!showId || !seasonNumber) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return this._userEpisodeRepository.getBySeasonForUser(userId, showId, seasonNumber);
    }

    /**
     * @param {string} userId
     * @param {number?} episodeId
     * @returns {Promise<number>} new view count
     */
    watch = async (userId, episodeId) => {
        if (!episodeId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const episode = await this._episodeRepository.getEpisodeById(episodeId);

        if (!episode) {
            throw new ServiceError(404, "Épisode introuvable");
        }
        if (!episode.date || Validator.isInFuture(episode.date)) {
            throw new ServiceError(400, "Cet épisode n'est pas encore diffusé");
        }
        await this._userEpisodeRepository.watch(userId, episodeId);
        return this._userEpisodeRepository.getViews(userId, episodeId);
    }

    /**
     * @param {string} userId
     * @param {number?} episodeId
     * @returns {Promise<number>} new view count
     */
    unwatch = async (userId, episodeId) => {
        if (!episodeId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const removed = await this._userEpisodeRepository.unwatch(userId, episodeId);

        if (!removed) {
            throw new ServiceError(400, "Aucun visionnage à supprimer");
        }
        return this._userEpisodeRepository.getViews(userId, episodeId);
    }
}
