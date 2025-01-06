import UserProfile from '../models/userProfile.js';
import FriendRepository from "../repositories/friendRepository.js";
import ServiceError from "../models/serviceError.js";

export default class FriendService {

    constructor() {
        this.friendRepository = new FriendRepository();
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
        const exists = await this.friendRepository.checkIfRelationExists(currentUserId, userId);

        if (exists) {
            throw new ServiceError(409, "Vous êtes déjà en relation avec cet utilisateur");
        }
        await this.friendRepository.sendFriendRequest(currentUserId, userId);
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
        await this.friendRepository.acceptFriend(userId, currentUserId);
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
        await this.friendRepository.deleteFriend(currentUserId, userId);
    }

    /**
     * @param {string} currentUserId
     * @param {string} status
     * @param {number} serieId
     * @returns {Promise<UserProfile[] | Map<string, UserProfile[]>>}
     */
    getFriends = async (currentUserId, status, serieId) => {
        return await this.#getFriendsByUserIdByStatus(currentUserId, status, serieId);
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {number?} showId
     * @returns {Promise<any>}
     */
    async #getFriendsByUserIdByStatus(userId, status, showId) {
        let rows = null;
        const mapToUser = (arr) => arr.map(user => new UserProfile(user));

        switch (status) {
            case "send":
                rows = (await this.friendRepository.getFriendsRequestsSend(userId));
                break;
            case "receive":
                rows = (await this.friendRepository.getFriendsRequestsReceive(userId));
                break;
            case "friend":
                rows = (await this.friendRepository.getFriends(userId));
                break;
            case "viewed":
                if (!showId) {
                    throw new Error("Requête invalide");
                }
                rows = await this.friendRepository.getFriendsWhoWatchSerie(userId, showId)
                break;
            default:
                return {
                    "send": mapToUser(await this.friendRepository.getFriendsRequestsSend(userId)),
                    "receive": mapToUser(await this.friendRepository.getFriendsRequestsReceive(userId)),
                    "friend": mapToUser(await this.friendRepository.getFriends(userId))
                }
        }
        return rows ? mapToUser(rows) : [];
    }
}
