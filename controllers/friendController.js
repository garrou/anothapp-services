import FriendService from "../services/friendService.js";

export default class FriendController {
    constructor() {
        this._friendService = new FriendService();
    }

    getFriends = async (req, res, next) => {
        try {
            const { status, serieId } = req.query;
            const users = await this._friendService.getFriends(req.userId, status, serieId);
            res.status(200).json(status ? { [status]: users } : users);
        } catch (e) {
            next(e);
        }
    }

    sendFriendRequest = async (req, res, next) => {
        try {
            const { userId } = req.body;
            await this._friendService.sendFriendRequest(req.userId, userId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    acceptFriend = async (req, res, next) => {
        try {
            const { userId } = req.body;
            await this._friendService.acceptFriend(req.userId, userId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    deleteFriend = async (req, res, next) => {
        try {
            const { userId } = req.params;
            await this._friendService.deleteFriend(req.userId, userId);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }
}