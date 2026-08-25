import ServiceError from "../helpers/serviceError.js";
import UserPlatformRepository from "../repositories/userPlatformRepository.js";
import FriendRepository from "../repositories/friendRepository.js";

export default class UserPlatformService {

    constructor() {
        this._userPlatformRepository = new UserPlatformRepository();
        this._friendRepository = new FriendRepository();
    }

    /**
     * @param {string} userId
     * @param {string?} friendId
     * @returns {Promise<number[]>}
     */
    getUserPlatforms = async (userId, friendId) => {
        if (friendId && !await this._friendRepository.checkIfAlreadyFriend(userId, friendId)) {
            throw new ServiceError(400, "Vous n'êtes pas en relation avec cette personne");
        }
        return this._userPlatformRepository.getUserPlatforms(friendId ?? userId);
    }

    /**
     * @param {string} userId 
     * @param {number} platforms 
     * @returns {Promise<void>}
     */
    addUserPlatforms = async (userId, platformId) => {
        const added = await this._userPlatformRepository.addUserPlatforms(userId, platformId);

        if (!added) {
            throw new ServiceError(500, "Impossible d'ajouter la plateforme");
        }
    }

    /**
     * 
     * @param {string} userId 
     * @param {number} platformId 
     * @returns {Promise<void>}
     */
    deleteUserPlatform = async (userId, platformId) => {
        const deleted = await this._userPlatformRepository.deleteUserPlatforms(userId, platformId);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer la plateforme");
        }
    }
}