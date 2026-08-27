import NotificationRepository from "../../repositories/notificationRepository.js";

/**
 * @returns {Promise<{created: number}>}
 */
const remindUpcomingEpisodes = async () => {
    const notificationRepository = new NotificationRepository();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const created = await notificationRepository.createUpcomingEpisodeReminders(date);
    return {created};
};

export default remindUpcomingEpisodes;
