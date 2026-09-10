import UserRepository from "../../repositories/userRepository.js";
import AchievementService from "../../services/achievementService.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * @returns {Promise<{evaluated: number, total: number, failed: any[]}>}
 */
const backfillAchievements = async () => {
    const userRepository = new UserRepository();
    const achievementService = new AchievementService();

    const userIds = await userRepository.getAllUserIds();

    const results = await mapWithConcurrency(userIds, CONCURRENCY, (userId) =>
        achievementService.evaluate(userId)
    );

    let evaluated = 0;
    const failed = [];

    for (let i = 0; i < userIds.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({userId: userIds[i], error: result.reason?.message ?? String(result.reason)});
        } else {
            evaluated += 1;
        }
    }
    return {evaluated, total: userIds.length, failed};
};

export default backfillAchievements;
