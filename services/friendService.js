import db from "../config/db.js";
import FriendRepository from "../repositories/friendRepository.js";
import PlaylistCollaboratorRepository from "../repositories/playlistCollaboratorRepository.js";
import UserSeasonFriendRepository from "../repositories/userSeasonFriendRepository.js";
import WatchTogetherRepository from "../repositories/watchTogetherRepository.js";
import ServiceError from "../helpers/serviceError.js";
import {DUPLICATE_ERROR_CODE, ERROR_ALREADY_FRIEND, ERROR_INVALID_REQUEST} from "../constants/errors.js";
import eventBus from "../helpers/eventBus.js";

export default class FriendService {

    constructor() {
        this._friendRepository = new FriendRepository();
        this._playlistCollaboratorRepository = new PlaylistCollaboratorRepository();
        this._userSeasonFriendRepository = new UserSeasonFriendRepository();
        this._watchTogetherRepository = new WatchTogetherRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    sendFriendRequest = async (currentUserId, userId) => {
        if (!userId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const exists = await this._friendRepository.checkIfRelationExists(currentUserId, userId);

        if (exists) {
            throw new ServiceError(409, ERROR_ALREADY_FRIEND);
        }
        let send;
        try {
            send = await this._friendRepository.sendFriendRequest(currentUserId, userId);
        } catch (err) {
            if (err.code === DUPLICATE_ERROR_CODE) {
                throw new ServiceError(409, ERROR_ALREADY_FRIEND);
            }
            throw err;
        }
        if (!send) {
            throw new ServiceError(500, "Impossible de demander cet utilisateur");
        }
        eventBus.emit("friend.request", {recipientUserId: userId, actorUserId: currentUserId});
    }

    /**
     * @param {string} currentUserId
     * @param {string} bodyUserId
     * @param {string} paramUserId
     * @returns {Promise<void>}
     */
    acceptFriend = async (currentUserId, bodyUserId, paramUserId) => {
        if (!bodyUserId || bodyUserId !== paramUserId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const accepted = await this._friendRepository.acceptFriend(bodyUserId, currentUserId);

        if (!accepted) {
            throw new ServiceError(500, "Impossible d'accepter cette demande");
        }
        eventBus.emit("friend.accepted", {recipientUserId: bodyUserId, actorUserId: currentUserId});
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    deleteFriend = async (currentUserId, userId) => {
        if (!userId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const deleted = await this._friendRepository.deleteFriend(currentUserId, userId);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer cet ami");
        }
        // Playlist collaboration and watch-together were both granted on the strength of the
        // friendship - revoke them in both directions so neither outlives the relationship it
        // depended on. Like every other revoke path, this never touches episodes already synced,
        // and it keeps the historical tag (declined/revoked), only the live relation is removed.
        // The tag and the relation are updated in one transaction so a failure between the two
        // can never leave one revoked while the other keeps routing episodes.
        await this._playlistCollaboratorRepository.removeAllBetween(currentUserId, userId);
        await db.transaction(async (client) => {
            await this._userSeasonFriendRepository.declineAllBetweenUsers(currentUserId, userId, client);
            await this._watchTogetherRepository.removeAllBetweenUsers(currentUserId, userId, client);
        });

        if (!deleted.wasAccepted && deleted.requesterId !== currentUserId) {
            eventBus.emit("friend.declined", {recipientUserId: deleted.requesterId, actorUserId: currentUserId});
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} status
     * @param {number} serieId
     * @returns {Promise<UserProfile[] | Map<string, UserProfile[]>>}
     */
    getFriends = async (currentUserId, status, serieId) => {
        return this.#getFriendsByUserIdByStatus(currentUserId, status, serieId);
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {number?} showId
     * @returns {Promise<any>}
     */
    async #getFriendsByUserIdByStatus(userId, status, showId) {
        switch (status) {
            case "sent":
                return this._friendRepository.getFriendsRequestsSend(userId);
            case "received":
                return this._friendRepository.getFriendsRequestsReceive(userId);
            case "friends":
                return this._friendRepository.getFriends(userId);
            case "viewed":
                if (!showId) {
                    throw new ServiceError(400, ERROR_INVALID_REQUEST);
                }
                return this._friendRepository.getFriendsWhoWatchSerie(userId, showId);
            default:
                return {
                    "sent": await this._friendRepository.getFriendsRequestsSend(userId),
                    "received": await this._friendRepository.getFriendsRequestsReceive(userId),
                    "friends": await this._friendRepository.getFriends(userId)
                }
        }
    }
}
