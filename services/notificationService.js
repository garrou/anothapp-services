import NotificationRepository from "../repositories/notificationRepository.js";
import ServiceError from "../helpers/serviceError.js";
import { ERROR_INVALID_REQUEST } from "../constants/errors.js";

export default class NotificationService {

    constructor() {
        this._notificationRepository = new NotificationRepository();
    }

    /**
     * @param {string} userId
     * @returns {Promise<Notification[]>}
     */
    getNotifications = async (userId) => this._notificationRepository.getByUserId(userId);

    /**
     * @param {string} userId
     * @returns {Promise<number>}
     */
    getUnreadCount = async (userId) => this._notificationRepository.getUnreadCountByUserId(userId);

    /**
     * @param {string} userId
     * @param {number?} id
     * @returns {Promise<void>}
     */
    markAsRead = async (userId, id) => {
        if (!id) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        await this._notificationRepository.markAsRead(userId, id);
    }

    /**
     * @param {string} userId
     * @returns {Promise<void>}
     */
    markAllAsRead = async (userId) => this._notificationRepository.markAllAsRead(userId);
}
