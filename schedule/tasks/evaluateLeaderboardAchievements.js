import UserRepository from "../../repositories/userRepository.js";
import FriendRepository from "../../repositories/friendRepository.js";
import UserSeasonRepository from "../../repositories/userSeasonRepository.js";
import UserEpisodeStatRepository from "../../repositories/userEpisodeStatRepository.js";
import AchievementService from "../../services/achievementService.js";
import mapWithConcurrency from "../lib/concurrency.js";

const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY ?? "8", 10);
const TOP_RANKS = 3;

/**
 * Unlocks "leaderboard_top3" for every user who ranked in the top 3 of their own
 * friend leaderboard this month - the same ranking statService.getLeaderboard shows,
 * evaluated once per user since the leaderboard is relative to each user's own friends.
 * @returns {Promise<{unlocked: number, failed: any[]}>}
 */
const evaluateLeaderboardAchievements = async () => {
    const userRepository = new UserRepository();
    const friendRepository = new FriendRepository();
    const userSeasonRepository = new UserSeasonRepository();
    const userEpisodeStatRepository = new UserEpisodeStatRepository();
    const achievementService = new AchievementService();

    const userIds = await userRepository.getAllUserIds();

    const results = await mapWithConcurrency(userIds, CONCURRENCY, async (userId) => {
        const friends = await friendRepository.getFriends(userId);
        const participantIds = [userId, ...friends.map((f) => f.id)];
        const trackingByUserId = await userRepository.getEpisodeTrackingByIds(participantIds);

        const seasonIds = participantIds.filter((id) => !trackingByUserId.get(id));
        const episodeIds = participantIds.filter((id) => trackingByUserId.get(id));

        const [seasonTimes, episodeTimes] = await Promise.all([
            userSeasonRepository.getTimeCurrentMonthByUserIds(seasonIds),
            userEpisodeStatRepository.getTimeCurrentMonthByUserIds(episodeIds),
        ]);
        const timeByUserId = new Map([...seasonTimes, ...episodeTimes]);

        const ranked = participantIds
            .map((id) => ({id, value: timeByUserId.get(id) ?? 0}))
            .sort((a, b) => b.value - a.value);
        const rank = ranked.findIndex((p) => p.id === userId);

        if (rank >= 0 && rank < TOP_RANKS && ranked[rank].value > 0) {
            await achievementService.unlockLeaderboardTop3(userId);
            return true;
        }
        return false;
    });

    let unlocked = 0;
    const failed = [];

    for (let i = 0; i < userIds.length; i += 1) {
        const result = results[i];

        if (result.status === "rejected") {
            failed.push({userId: userIds[i], error: result.reason?.message ?? String(result.reason)});
        } else if (result.value) {
            unlocked += 1;
        }
    }
    return {unlocked, failed};
};

export default evaluateLeaderboardAchievements;
