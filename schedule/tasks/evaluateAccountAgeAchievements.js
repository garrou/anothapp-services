import UserRepository from "../../repositories/userRepository.js";
import AchievementService from "../../services/achievementService.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

/**
 * "account_age" doesn't depend on any user action (it only advances with time), so unlike
 * the other achievements it is deliberately excluded from AchievementListener's per-event
 * evaluations - an inactive user would otherwise never see it move. This task re-checks it
 * for every user on its own schedule instead (monthly is plenty, given the coarsest tier
 * granularity is 1 month).
 * @returns {Promise<{evaluated: number, total: number, failed: any[]}>}
 */
const evaluateAccountAgeAchievements = async () => {
    const userRepository = new UserRepository();
    const achievementService = new AchievementService();

    const userIds = await userRepository.getAllUserIds();

    const results = await mapWithConcurrency(userIds, CONCURRENCY, (userId) =>
        achievementService.evaluate(userId, ["account_age"])
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

export default evaluateAccountAgeAchievements;
