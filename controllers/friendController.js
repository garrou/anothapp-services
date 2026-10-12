import FriendService from "../services/friendService.js";

export default class FriendController {
    constructor() {
        this._friendService = new FriendService();
    }

    /**
     * @returns {Promise<void>}
     */
    getFriends = async (req, res, next) => {
        try {
            const {status, serieId} = req.query;
            const users = await this._friendService.getFriends(req.userId, status, serieId);
            res.status(200).json(status ? {[status]: users} : users);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    sendFriendRequest = async (req, res, next) => {
        try {
            const {userId} = req.body;
            await this._friendService.sendFriendRequest(req.userId, userId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    acceptFriend = async (req, res, next) => {
        try {
            await this._friendService.acceptFriend(req.userId, req.body.userId, req.params.userId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    deleteFriend = async (req, res, next) => {
        try {
            const {userId} = req.params;
            await this._friendService.deleteFriend(req.userId, userId);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    getAutoAcceptWatchTogether = async (req, res, next) => {
        try {
            const enabled = await this._friendService.getAutoAcceptWatchTogether(req.userId, req.params.userId);
            res.status(200).json({enabled});
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    setAutoAcceptWatchTogether = async (req, res, next) => {
        try {
            const {enabled} = req.body;
            await this._friendService.setAutoAcceptWatchTogether(req.userId, req.params.userId, enabled);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }
}