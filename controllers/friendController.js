import { FriendService } from "../services/friendService.js";

export class FriendController {
    constructor() {
        this.friendService = new FriendService();
    }

    async getFriends(req, res, next) {
        try {
            const { status, serieId } = req.query;
            const users = await this.friendService.getFriends(req.userId, status, serieId);
            res.status(200).json(status ? { [status]: users } : users);
        } catch (e) {
            next(e);
        }
    }

    async sendFriendRequest(req, res, next){
        try {
            const { userId } = req.body;
            await this.friendService.sendFriendRequest(req.userId, userId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    async acceptFriend(req, res, next){
        try {
            const { userId } = req.body;
            await this.friendService.acceptFriend(req.userId, userId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    async deleteFriend(req, res, next){
        try {
            const { userId } = req.params;
            await this.friendService.deleteFriend(req.userId, userId);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }
}