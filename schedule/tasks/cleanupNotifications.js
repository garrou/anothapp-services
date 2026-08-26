import NotificationRepository from "../../repositories/notificationRepository.js";

const NOTIFICATION_RETENTION_DAYS = parseInt(process.env.NOTIFICATION_RETENTION_DAYS ?? "30", 10);

/**
 * @returns {Promise<{deleted: number}>}
 */
const cleanupNotifications = async () => {
    const notificationRepository = new NotificationRepository();
    const deleted = await notificationRepository.deleteOlderThanDays(NOTIFICATION_RETENTION_DAYS);
    return {deleted};
};

export default cleanupNotifications;
