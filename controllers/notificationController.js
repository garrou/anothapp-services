import NotificationService from "../services/notificationService.js";

export default class NotificationController {

    constructor() {
        this._notificationService = new NotificationService();
    }

    getNotifications = async (req, res, next) => {
        try {
            const [notifications, unreadCount] = await Promise.all([
                this._notificationService.getNotifications(req.userId),
                this._notificationService.getUnreadCount(req.userId),
            ]);
            res.status(200).json({ notifications, unreadCount });
        } catch (e) {
            next(e);
        }
    }

    markAsRead = async (req, res, next) => {
        try {
            await this._notificationService.markAsRead(req.userId, Number(req.params.id));
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    markAllAsRead = async (req, res, next) => {
        try {
            await this._notificationService.markAllAsRead(req.userId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }
}
