import SeasonRepository from "../repositories/seasonRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserSeasonFriendRepository from "../repositories/userSeasonFriendRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import EpisodeService from "./episodeService.js";
import ServiceError from "../helpers/serviceError.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";
import {MAX_WATCHED_WITH, MONTHS_SHORTCUTS} from "../constants/validation.js";
import eventBus from "../helpers/eventBus.js";

export default class SeasonService {

    constructor() {
        this._seasonRepository = new SeasonRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._userSeasonFriendRepository = new UserSeasonFriendRepository();
        this._friendRepository = new FriendRepository();
        this._episodeService = new EpisodeService();
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
     * @param {string} currentUserId
     * @param {number?} id
     * @returns {Promise<UserEpisode[]>}
     */
    getEpisodesBySeasonId = async (currentUserId, id) => {
        return this._episodeService.getByUserSeasonId(currentUserId, id);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @param {number?} episodeId
     * @returns {Promise<void>}
     */
    addEpisodeViewing = async (currentUserId, id, episodeId) => {
        return this._episodeService.addViewing(currentUserId, id, episodeId);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} id
     * @returns {Promise<void>}
     */
    addAllEpisodesViewing = async (currentUserId, id) => {
        return this._episodeService.addAllViewings(currentUserId, id);
    }

    /**
     * @param currentUserId
     * @param year
     * @param month
     * @returns {Promise<SeasonTimeline[] | Season[]>}
     */
    getSeasons = async (currentUserId, year, month) => {
        if (MONTHS_SHORTCUTS.includes(month)) {
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
        await this._episodeService.updatePlatformForSeason(currentUserId, seasonId, platformId);
    }

    /**
     * @param {string} currentUserId
     * @param {number?} seasonId
     * @param {string[]?} friendIds
     * @returns {Promise<void>}
     */
    updateWatchedWith = async (currentUserId, seasonId, friendIds = []) => {
        if (!seasonId || !Array.isArray(friendIds)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const uniqueFriendIds = [...new Set(friendIds)];

        if (uniqueFriendIds.length > MAX_WATCHED_WITH) {
            throw new ServiceError(400, `Vous ne pouvez pas taguer plus de ${MAX_WATCHED_WITH} amis`);
        }
        const owned = await this._userSeasonRepository.getOwnedSeasonViewing(currentUserId, seasonId);

        if (!owned) {
            throw new ServiceError(404, "Visionnage introuvable");
        }
        if (uniqueFriendIds.length) {
            const friends = await this._friendRepository.getFriends(currentUserId);
            const friendIdSet = new Set(friends.map((friend) => friend.id));

            if (!uniqueFriendIds.every((id) => friendIdSet.has(id))) {
                throw new ServiceError(400, "Vous ne pouvez taguer que des amis");
            }
        }
        await this._userSeasonFriendRepository.setForUserSeasonId(seasonId, uniqueFriendIds);

        if (uniqueFriendIds.length) {
            eventBus.emit("season.watched_with", {
                actorUserId: currentUserId,
                recipientIds: uniqueFriendIds,
                showId: owned.showId,
                metadata: {seasonNumber: owned.number}
            });
        }
    }
}
