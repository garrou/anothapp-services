import UserPlatformService from "../services/userPlatformService.js";

export default class PlatformController {
    constructor() {
        this._userPlatformService = new UserPlatformService();
    }
    
    /**
     * @returns {Promise<void>}
     */
    getUserPlatforms = async (req, res, next) => {
        try {
            const {friendId} = req.query;
            const platforms = await this._userPlatformService.getUserPlatforms(req.userId, friendId);
            res.status(200).json(platforms);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    addUserPlatforms = async (req, res, next) => {
        try {
            await this._userPlatformService.addUserPlatforms(req.userId, req.body.platformId);
            res.status(200).json({ message: "Plateforme ajoutée" });
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    deleteUserPlatform = async (req, res, next) => {
        try {
            await this._userPlatformService.deleteUserPlatform(req.userId, req.params.id);
            res.status(200).json({ message: "Plateforme supprimée" });
        } catch (e) {
            next(e);
        }
    }
}