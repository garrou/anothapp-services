import EpisodeRepository from "../repositories/episodeRepository.js";
import UserEpisodeRepository from "../repositories/userEpisodeRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import WatchTogetherRepository from "../repositories/watchTogetherRepository.js";
import SearchService from "./searchService.js";
import ServiceError from "../helpers/serviceError.js";
import Validator from "../helpers/validator.js";
import {ERROR_INVALID_REQUEST, ERROR_VIEWING_NOT_IN_COLLECTION} from "../constants/errors.js";
import {MONTHS_SHORTCUTS} from "../constants/validation.js";
import eventBus from "../helpers/eventBus.js";

export default class EpisodeService {

    constructor() {
        this._episodeRepository = new EpisodeRepository();
        this._userEpisodeRepository = new UserEpisodeRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._watchTogetherRepository = new WatchTogetherRepository();
        this._searchService = new SearchService();
    }

    /**
     * @param {number} userSeasonId
     * @param {number} episodeId
     * @param {string} watchedAt
     * @param {number} platformId
     * @returns {Promise<void>}
     */
    #mirrorToLinkedViewings = async (userSeasonId, episodeId, watchedAt, platformId) => {
        const linked = await this._watchTogetherRepository.getLinkedViewings(userSeasonId);
        await this.#mirrorEpisodesToViewings(linked, [episodeId], watchedAt, platformId);
    }

    /**
     * @param {number} userSeasonId
     * @param {number[]} episodeIds
     * @param {string} watchedAt
     * @param {number} platformId
     * @returns {Promise<void>}
     */
    #mirrorManyToLinkedViewings = async (userSeasonId, episodeIds, watchedAt, platformId) => {
        const linked = await this._watchTogetherRepository.getLinkedViewings(userSeasonId);
        await this.#mirrorEpisodesToViewings(linked, episodeIds, watchedAt, platformId);
    }

    /**
     * @param {{id: number, userId: string}[]} linked
     * @param {number[]} episodeIds
     * @param {string} watchedAt
     * @param {number} platformId
     * @returns {Promise<void>}
     */
    #mirrorEpisodesToViewings = async (linked, episodeIds, watchedAt, platformId) => {
        await Promise.all(linked.flatMap((viewing) => episodeIds.map((episodeId) =>
            this._userEpisodeRepository.createIfMissing(viewing.userId, viewing.id, episodeId, watchedAt, platformId)
        )));
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
     * @param {number?} userSeasonId
     * @returns {Promise<UserEpisode[]>}
     */
    getByUserSeasonId = async (userId, userSeasonId) => {
        if (!userSeasonId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const season = await this._userSeasonRepository.getOwnedSeasonViewing(userId, userSeasonId);

        if (!season) {
            throw new ServiceError(400, ERROR_VIEWING_NOT_IN_COLLECTION);
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
        const season = await this._userSeasonRepository.getOwnedSeasonViewing(userId, userSeasonId);

        if (!season) {
            throw new ServiceError(400, ERROR_VIEWING_NOT_IN_COLLECTION);
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
        const watchedAt = new Date().toISOString();
        const created = await this._userEpisodeRepository.create(
            userId, userSeasonId, episodeId, watchedAt, season.platformId
        );

        if (!created) {
            throw new ServiceError(500, "Impossible d'ajouter le visionnage");
        }
        eventBus.emit("episode.watched", {
            actorUserId: userId,
            showId: season.showId,
            metadata: {seasonNumber: season.number, episodeCode: episode.code, episodeTitle: episode.title},
        });
        await this.#mirrorToLinkedViewings(userSeasonId, episodeId, watchedAt, season.platformId);
    }

    /**
     * @param {string} userId
     * @param {number?} userSeasonId
     * @returns {Promise<void>}
     */
    addAllViewings = async (userId, userSeasonId) => {
        if (!userSeasonId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const season = await this._userSeasonRepository.getOwnedSeasonViewing(userId, userSeasonId);

        if (!season) {
            throw new ServiceError(400, ERROR_VIEWING_NOT_IN_COLLECTION);
        }
        const episodes = await this.#ensureEpisodesExist(season.showId, season.number);
        const aired = episodes.filter((e) => e.date && !Validator.isInFuture(e.date));
        const watchedAt = new Date().toISOString();

        const created = await Promise.all(aired.map((episode) =>
            this._userEpisodeRepository.createIfMissing(userId, userSeasonId, episode.id, watchedAt, season.platformId)
        ));
        const newlyWatched = aired.filter((_, i) => created[i]);

        if (newlyWatched.length > 0) {
            eventBus.emit("episode.bulk_watched", {
                actorUserId: userId,
                showId: season.showId,
                metadata: {seasonNumber: season.number, count: newlyWatched.length},
            });
            await this.#mirrorManyToLinkedViewings(
                userSeasonId, newlyWatched.map((episode) => episode.id), watchedAt, season.platformId
            );
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
        await this._userEpisodeRepository.updatePlatformByUserSeasonId(userSeasonId, platformId);
    }

    /**
     * Called once, right when a watch-together invite is accepted: from then on, marking an
     * episode watched already mirrors it to every linked viewing (see #mirrorToLinkedViewings),
     * but that only covers episodes watched from this point forward. Without this, whichever
     * member already had episodes marked before joining - the root, an existing friend, or the one
     * just accepting - would keep looking behind the rest of the group. Runs after the new link is
     * already written (in the same transaction as `client`), so getLinkedViewings already includes
     * the newcomer alongside every pre-existing member - the merge below is the union of everyone's
     * history, applied to everyone, not just a pairwise copy between the root and the newcomer.
     * @param {number} userSeasonId the group's root viewing id
     * @param {string} rootUserId
     * @param {import("pg").PoolClient} client
     * @returns {Promise<string[]>} the ids of the members who actually received at least one
     *   backfilled episode - the caller uses this to re-evaluate their episode-based achievements,
     *   since these rows are inserted directly rather than through addViewing/addAllViewings, which
     *   would otherwise be the ones emitting "episode.watched"/"episode.bulk_watched" for that
     */
    backfillLinkedViewings = async (userSeasonId, rootUserId, client) => {
        const members = [
            {id: userSeasonId, userId: rootUserId},
            ...await this._watchTogetherRepository.getLinkedViewings(userSeasonId, client),
        ];
        // A transaction client is a single Postgres connection - unlike the pool, it can't run
        // queries concurrently, so every query against it here is awaited one at a time.
        const watchedByMember = new Map();

        for (const member of members) {
            watchedByMember.set(member.id, await this._userEpisodeRepository.getWatchedForUserSeasonId(member.id, client));
        }
        const union = new Map();

        for (const watched of watchedByMember.values()) {
            for (const episode of watched) {
                if (!union.has(episode.episodeId)) {
                    union.set(episode.episodeId, episode);
                }
            }
        }
        const backfilledUserIds = [];

        for (const member of members) {
            const alreadyWatched = new Set(watchedByMember.get(member.id).map((e) => e.episodeId));
            let backfilled = false;

            for (const [episodeId, episode] of union) {
                if (!alreadyWatched.has(episodeId)) {
                    await this._userEpisodeRepository.createIfMissing(
                        member.userId, member.id, episodeId, episode.watchedAt, episode.platformId, client
                    );
                    backfilled = true;
                }
            }
            if (backfilled) {
                backfilledUserIds.push(member.userId);
            }
        }
        return backfilledUserIds;
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
