import ServiceError from "../helpers/serviceError.js";
import Platform from "../models/platform.js";
import UserPlatformRepository from "../repositories/userPlatformRepository.js";

export default class UserPlatformService {

    constructor() {
        this._userPlatformRepository = new UserPlatformRepository();
    }

    /**
     * @param {string} userId 
     * @returns {Promise<number[]>}
     */
    getUserPlatforms = async (userId) => this._userPlatformRepository.getUserPlatforms(userId);

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