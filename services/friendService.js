import UserProfile from '../models/UserProfile.js';
import { FriendRepository } from "../repositories/friendRepository.js";

export class FriendService {

    constructor() {
        this.friendRepository = new FriendRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async sendFriendRequest(currentUserId, userId) {

        if (!userId) {
            throw new Error("Requête invalide");
        }
        const exists = await this.friendRepository.checkIfRelationExists(currentUserId, userId);

        if (exists) {
            throw new Error("Vous êtes déjà en relation avec cet utilisateur");
        }
        await this.friendRepository.sendFriendRequest(currentUserId, userId);
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async acceptFriend(currentUserId, userId) {

        if (!userId) {
            throw new Error("Requête invalide");
        }
        await this.friendRepository.acceptFriend(userId, currentUserId);
    }

    /**
     * @param {string} currentUserId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async deleteFriend(currentUserId, userId) {

        if (!userId) {
            throw new Error("Requête invalide");
        }
        await this.friendRepository.deleteFriend(currentUserId, userId);
    }

    /**
     * @param {string} currentUserId
     * @param {string} status
     * @param {number} serieId
     * @returns {Promise<void>}
     */
    async getFriends(currentUserId, status, serieId) {
        return this.#getFriendsByUserIdByStatus(currentUserId, status, serieId);
    }

    /**
     * @param {string} userId
     * @param {string} status
     * @param {number?} showId
     * @returns {Promise<Friend[]> | Promise<Map<string, Friend[]>}
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
