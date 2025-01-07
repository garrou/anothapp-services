import FriendRepository from "../repositories/friendRepository.js";
import ServiceError from "../helpers/serviceError.js";

export default class FriendService {

    constructor() {
        this._friendRepository = new FriendRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    sendFriendRequest = async (currentUserId, userId) => {
        if (!userId) {
            throw new ServiceError(400, "Requête invalide");
        }
        const exists = await this._friendRepository.checkIfRelationExists(currentUserId, userId);

        if (exists) {
            throw new ServiceError(409, "Vous êtes déjà en relation avec cet utilisateur");
        }
        const send = await this._friendRepository.sendFriendRequest(currentUserId, userId);

        if (!send) {
            throw new ServiceError(500, "Impossible de demander cet utilisateur");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    acceptFriend = async (currentUserId, userId) => {
        if (!userId) {
            throw new ServiceError(400, "Requête invalide");
        }
        const accepted = await this._friendRepository.acceptFriend(userId, currentUserId);

        if (!accepted) {
            throw new ServiceError(500, "Impossible d'accepter cette demande");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    deleteFriend = async (currentUserId, userId) => {
        if (!userId) {
            throw new ServiceError(400, "Requête invalide");
        }
        const deleted = await this._friendRepository.deleteFriend(currentUserId, userId);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer cet ami");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} status
     * @param {number} serieId
     * @returns {Promise<UserProfile[] | Map<string, UserProfile[]>>}
     */
    getFriends = async (currentUserId, status, serieId) => {
        return await this._getFriendsByUserIdByStatus(currentUserId, status, serieId);
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {number?} showId
     * @returns {Promise<any>}
     */
    async _getFriendsByUserIdByStatus(userId, status, showId) {
        switch (status) {
            case "send":
                return await this._friendRepository.getFriendsRequestsSend(userId);
            case "receive":
                return await this._friendRepository.getFriendsRequestsReceive(userId);
            case "friend":
                return await this._friendRepository.getFriends(userId);
            case "viewed":
                if (!showId) {
                    throw new Error("Requête invalide");
                }
                return await this._friendRepository.getFriendsWhoWatchSerie(userId, showId);
            default:
                return {
                    "send": await this._friendRepository.getFriendsRequestsSend(userId),
                    "receive": await this._friendRepository.getFriendsRequestsReceive(userId),
                    "friend": await this._friendRepository.getFriends(userId)
                }
        }
    }
}
