import UserRepository from "../../repositories/userRepository.js";
import AchievementService from "../../services/achievementService.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);

const ACCOUNT_AGE_SYNC_DAY = 1;

/**
 * "account_age" doesn't depend on any user action (it only advances with time), so unlike
 * the other achievements it is deliberately excluded from AchievementListener's per-event
 * evaluations - an inactive user would otherwise never see it move. This task re-checks it
 * for every user on its own schedule instead. It runs in the same daily cron as the other
 * tasks, so it skips itself outside ACCOUNT_AGE_SYNC_DAY - monthly is plenty given the
 * coarsest tier granularity is 1 month, and re-checking daily would just be 30x the DB work
 * for the same result.
 * @returns {Promise<{skipped: boolean, evaluated: number, total: number, failed: any[]}>}
 */
const evaluateAccountAgeAchievements = async () => {
    if (new Date().getDate() !== ACCOUNT_AGE_SYNC_DAY) {
        return {skipped: true, evaluated: 0, total: 0, failed: []};
    }
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
    return {skipped: false, evaluated, total: userIds.length, failed};
};

export default evaluateAccountAgeAchievements;
