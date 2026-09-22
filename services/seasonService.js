import db from "../config/db.js";
import SeasonRepository from "../repositories/seasonRepository.js";
import UserSeasonRepository from "../repositories/userSeasonRepository.js";
import UserSeasonFriendRepository from "../repositories/userSeasonFriendRepository.js";
import WatchTogetherRepository from "../repositories/watchTogetherRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import EpisodeService from "./episodeService.js";
import ShowService from "./showService.js";
import ServiceError from "../helpers/serviceError.js";
import Validator from "../helpers/validator.js";
import {ERROR_INVALID_REQUEST, ERROR_NOT_FRIEND} from "../constants/errors.js";
import {MAX_WATCHED_WITH} from "../constants/validation.js";
import eventBus from "../helpers/eventBus.js";

export default class SeasonService {

    constructor() {
        this._seasonRepository = new SeasonRepository();
        this._userSeasonRepository = new UserSeasonRepository();
        this._userSeasonFriendRepository = new UserSeasonFriendRepository();
        this._watchTogetherRepository = new WatchTogetherRepository();
        this._friendRepository = new FriendRepository();
        this._episodeService = new EpisodeService();
        this._showService = new ShowService();
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
        // A friend dropped from the list while their invite was accepted loses the live sync too -
        // the historical tag stays (now "revoked"), only the relation actually routing episodes ends.
        // Both writes happen in one transaction so a friend can never end up "revoked" with their
        // relation still routing episodes, or vice versa.
        const {invited} = await db.transaction(async (client) => {
            const result = await this._userSeasonFriendRepository.setForUserSeasonId(seasonId, uniqueFriendIds, client);
            await Promise.all(result.revoked.map((friendId) => this._watchTogetherRepository.remove(seasonId, friendId, client)));
            return result;
        });

        if (invited.length) {
            eventBus.emit("season.watched_with", {
                actorUserId: currentUserId,
                recipientIds: invited,
                showId: owned.showId,
                metadata: {seasonNumber: owned.number}
            });
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} status "pending" or "active"
     * @returns {Promise<Object[]>}
     */
    getWatchedWith = async (currentUserId, status) => {
        switch (status) {
            case "pending":
                return this._userSeasonFriendRepository.getPendingForUser(currentUserId);
            case "active":
                return this._watchTogetherRepository.getActiveForUser(currentUserId);
            default:
                throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
    }

    /**
     * @param {string} currentUserId
     * @param {number?} userSeasonId
     * @param {boolean} accepted
     * @returns {Promise<void>}
     */
    respondToWatchedWith = async (currentUserId, userSeasonId, accepted) => {
        if (!userSeasonId || !Validator.isBoolean(accepted)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const status = await this._userSeasonFriendRepository.getStatus(userSeasonId, currentUserId);

        if (status === undefined) {
            throw new ServiceError(404, "Invitation introuvable");
        }
        const owned = await this._userSeasonRepository.getSeasonViewingById(userSeasonId);

        if (!accepted) {
            // Marking declined here always keeps the historical tag (never deleted); revoking the
            // live relation is a plain no-op when the invite was never accepted in the first place.
            // Both writes happen in one transaction: the tag can never end up "revoked" while the
            // relation is still routing episodes, or the other way around.
            await db.transaction(async (client) => {
                await this._userSeasonFriendRepository.decline(userSeasonId, currentUserId, client);
                await this._watchTogetherRepository.remove(userSeasonId, currentUserId, client);
            });
            eventBus.emit("season.watched_with.declined", {
                recipientUserId: owned.userId, actorUserId: currentUserId,
                showId: owned.showId, metadata: {seasonNumber: owned.number},
            });
            return;
        }
        // Friendship is only checked when the invite is created (updateWatchedWith) - it may have
        // ended since (unfriend, or the invite predates it), so it's re-checked here too, otherwise
        // a stale/declined-by-unfriend invite could be (re)accepted between two people no longer friends.
        const stillFriends = await this._friendRepository.checkIfAlreadyFriend(owned.userId, currentUserId);

        if (!stillFriends) {
            throw new ServiceError(400, ERROR_NOT_FRIEND);
        }
        const friendUsersSeasonId = await this._showService.ensureSeasonTracked(
            currentUserId, owned.showId, owned.number, owned.platformId
        );
        // The conflict check and the two writes below all run under one advisory lock on both
        // seasons, in the same transaction, so two concurrent accepts touching either season can
        // never both pass the check before either has written - closing the race hasConflictingLink
        // would otherwise have on its own.
        const linked = await db.transaction(async (client) => {
            await this._watchTogetherRepository.lockSeasons(client, userSeasonId, friendUsersSeasonId);
            const conflict = await this._watchTogetherRepository.hasConflictingLink(userSeasonId, friendUsersSeasonId, client);

            if (conflict) {
                throw new ServiceError(409, "Ce visionnage participe déjà à un autre visionnage partagé");
            }
            await this._userSeasonFriendRepository.accept(userSeasonId, currentUserId, client);
            const created = await this._watchTogetherRepository.create(userSeasonId, friendUsersSeasonId, client);

            if (created) {
                await this._episodeService.backfillLinkedViewings(
                    owned.userId, userSeasonId, currentUserId, friendUsersSeasonId, client
                );
            }
            return created;
        });

        if (!linked) {
            throw new ServiceError(500, "Impossible d'accepter cette invitation");
        }
        eventBus.emit("season.watched_with.accepted", {
            recipientUserId: owned.userId, actorUserId: currentUserId,
            showId: owned.showId, metadata: {seasonNumber: owned.number},
        });
    }
}
