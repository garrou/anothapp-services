import { describe, it, expect, vi, beforeEach } from "vitest";
import AchievementService from "./achievementService.js";

const achievementRepoMocks = vi.hoisted(() => ({
    getTiers: vi.fn(),
    getUserAchievements: vi.fn(),
    getUserAchievement: vi.fn(),
    upsertUserAchievement: vi.fn(),
}));
const userRepoMocks = vi.hoisted(() => ({
    hasEpisodeTrackingEnabled: vi.fn(),
    getUserById: vi.fn(),
}));
const userShowRepoMocks = vi.hoisted(() => ({
    getTotalShowsByUserId: vi.fn(),
    getTotalCompletedShowsByUserId: vi.fn(),
    getCountriesCountByUserId: vi.fn(),
    getKindsCountByUserId: vi.fn(),
    getNotedShowsCountByUserId: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getWatchedDatesByUserId: vi.fn(),
    getTotalTimeByUserId: vi.fn(),
    getPlatformsCountByUserId: vi.fn(),
}));
const userEpisodeStatRepoMocks = vi.hoisted(() => ({
    getWatchedDatesByUserId: vi.fn(),
    getTotalTimeByUserId: vi.fn(),
}));
const userSeasonFriendRepoMocks = vi.hoisted(() => ({
    getDistinctFriendsCountByUserId: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    getFriends: vi.fn(),
    checkIfAlreadyFriend: vi.fn(),
}));
const notificationRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
}));

vi.mock("../repositories/achievementRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return achievementRepoMocks; }),
}));
vi.mock("../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../repositories/userShowRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userShowRepoMocks; }),
}));
vi.mock("../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../repositories/userEpisodeStatRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeStatRepoMocks; }),
}));
vi.mock("../repositories/userSeasonFriendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonFriendRepoMocks; }),
}));
vi.mock("../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));
vi.mock("../repositories/notificationRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return notificationRepoMocks; }),
}));

const streakTiers = () => [
    { code: "streak", league: 1, subTier: 3, threshold: 1 },
    { code: "streak", league: 1, subTier: 2, threshold: 3 },
    { code: "streak", league: 1, subTier: 1, threshold: 7 },
    { code: "streak", league: 2, subTier: 3, threshold: 10 },
];

const mockDefaults = () => {
    userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
    userRepoMocks.getUserById.mockResolvedValue({ createdAt: new Date().toISOString() });
    userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue([]);
    userSeasonRepoMocks.getTotalTimeByUserId.mockResolvedValue(0);
    userSeasonRepoMocks.getPlatformsCountByUserId.mockResolvedValue(0);
    userShowRepoMocks.getTotalShowsByUserId.mockResolvedValue(0);
    userShowRepoMocks.getTotalCompletedShowsByUserId.mockResolvedValue(0);
    userShowRepoMocks.getCountriesCountByUserId.mockResolvedValue(0);
    userShowRepoMocks.getKindsCountByUserId.mockResolvedValue(0);
    userShowRepoMocks.getNotedShowsCountByUserId.mockResolvedValue(0);
    userSeasonFriendRepoMocks.getDistinctFriendsCountByUserId.mockResolvedValue(0);
    friendRepoMocks.getFriends.mockResolvedValue([]);
    achievementRepoMocks.getUserAchievements.mockResolvedValue(new Map());
    achievementRepoMocks.upsertUserAchievement.mockResolvedValue(true);
};

beforeEach(() => {
    vi.clearAllMocks();
    mockDefaults();
});

describe("AchievementService.evaluate", () => {
    let achievementService;

    beforeEach(() => {
        achievementService = new AchievementService();
    });

    it("unlocks and notifies when the user newly crosses a tier", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(["2024-01-01", "2024-01-02", "2024-01-03"]);

        await achievementService.evaluate("user-1");

        expect(achievementRepoMocks.upsertUserAchievement).toHaveBeenCalledWith("user-1", "streak", 1, 2);
        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", undefined, "achievement_unlocked", undefined, { code: "streak", league: 1, subTier: 2 }
        );
    });

    it("does not notify when the DB write is rejected by the concurrent-write guard", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(["2024-01-01", "2024-01-02", "2024-01-03"]);
        achievementRepoMocks.upsertUserAchievement.mockResolvedValue(false);

        await achievementService.evaluate("user-1");

        expect(achievementRepoMocks.upsertUserAchievement).toHaveBeenCalledWith("user-1", "streak", 1, 2);
        expect(notificationRepoMocks.create).not.toHaveBeenCalled();
    });

    it("does nothing when no tier is reached yet", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue([]);

        await achievementService.evaluate("user-1");

        expect(achievementRepoMocks.upsertUserAchievement).not.toHaveBeenCalled();
        expect(notificationRepoMocks.create).not.toHaveBeenCalled();
    });

    it("does not re-unlock a tier already reached", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        achievementRepoMocks.getUserAchievements.mockResolvedValue(new Map([
            ["streak", { league: 1, subTier: 2 }],
        ]));
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(["2024-01-01", "2024-01-02", "2024-01-03"]);

        await achievementService.evaluate("user-1");

        expect(achievementRepoMocks.upsertUserAchievement).not.toHaveBeenCalled();
    });

    it("upgrades to a strictly higher tier reached since the last evaluation", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        achievementRepoMocks.getUserAchievements.mockResolvedValue(new Map([
            ["streak", { league: 1, subTier: 2 }],
        ]));
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(
            Array.from({ length: 10 }, (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`)
        );

        await achievementService.evaluate("user-1");

        expect(achievementRepoMocks.upsertUserAchievement).toHaveBeenCalledWith("user-1", "streak", 2, 3);
    });

    it("reads episode watch dates for episode-tracking users instead of season dates", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getWatchedDatesByUserId.mockResolvedValue(["2024-01-01"]);

        await achievementService.evaluate("user-1");

        expect(userEpisodeStatRepoMocks.getWatchedDatesByUserId).toHaveBeenCalledWith("user-1");
        expect(userSeasonRepoMocks.getWatchedDatesByUserId).not.toHaveBeenCalled();
    });
});

describe("AchievementService.unlockLeaderboardTop3", () => {
    let achievementService;

    beforeEach(() => {
        achievementService = new AchievementService();
    });

    it("unlocks and notifies the first time", async () => {
        achievementRepoMocks.getUserAchievement.mockResolvedValue(null);

        await achievementService.unlockLeaderboardTop3("user-1");

        expect(achievementRepoMocks.upsertUserAchievement).toHaveBeenCalledWith("user-1", "leaderboard_top3", 1, 1);
        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", undefined, "achievement_unlocked", undefined, { code: "leaderboard_top3", league: 1, subTier: 1 }
        );
    });

    it("is a no-op once already unlocked", async () => {
        achievementRepoMocks.getUserAchievement.mockResolvedValue({ league: 1, subTier: 1 });

        await achievementService.unlockLeaderboardTop3("user-1");

        expect(achievementRepoMocks.upsertUserAchievement).not.toHaveBeenCalled();
    });

    it("does not notify when the DB write is rejected by the concurrent-write guard", async () => {
        achievementRepoMocks.getUserAchievement.mockResolvedValue(null);
        achievementRepoMocks.upsertUserAchievement.mockResolvedValue(false);

        await achievementService.unlockLeaderboardTop3("user-1");

        expect(notificationRepoMocks.create).not.toHaveBeenCalled();
    });
});

describe("AchievementService.getAchievements", () => {
    let achievementService;

    beforeEach(() => {
        achievementService = new AchievementService();
    });

    it("reports progress toward the next tier when none has been reached", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(["2024-01-01"]);

        const achievements = await achievementService.getAchievements("user-1");
        const streak = achievements.find((a) => a.code === "streak");

        expect(streak.value).toBe(1);
        expect(streak.league).toBeNull();
        expect(streak.nextLeague).toBe(1);
        expect(streak.nextSubTier).toBe(3);
        expect(streak.progress).toBeCloseTo(1 / 1);
    });

    it("reports progress from the reached tier's floor toward the next one", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        achievementRepoMocks.getUserAchievements.mockResolvedValue(new Map([
            ["streak", { league: 1, subTier: 3, unlockedAt: "2024-01-01T00:00:00.000Z" }],
        ]));
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(
            Array.from({ length: 2 }, (_, i) => `2024-01-0${i + 1}`)
        );

        const achievements = await achievementService.getAchievements("user-1");
        const streak = achievements.find((a) => a.code === "streak");

        expect(streak.league).toBe(1);
        expect(streak.subTier).toBe(3);
        expect(streak.unlockedAt).toBe("2024-01-01T00:00:00.000Z");
        expect(streak.progress).toBeCloseTo((2 - 1) / (3 - 1));
    });

    it("reports full progress when the top tier is reached", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue([
            { code: "streak", league: 1, subTier: 3, threshold: 1 },
        ]);
        achievementRepoMocks.getUserAchievements.mockResolvedValue(new Map([
            ["streak", { league: 1, subTier: 3, unlockedAt: "2024-01-01T00:00:00.000Z" }],
        ]));
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(["2024-01-01"]);

        const achievements = await achievementService.getAchievements("user-1");
        const streak = achievements.find((a) => a.code === "streak");

        expect(streak.nextThreshold).toBeNull();
        expect(streak.progress).toBe(1);
    });

    it("rejects a friendId that isn't an accepted friend", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(achievementService.getAchievements("user-1", "user-2")).rejects.toThrow();
    });

    it("only returns unlocked achievements when viewing a friend", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        achievementRepoMocks.getUserAchievements.mockResolvedValue(new Map([
            ["streak", { league: 1, subTier: 3, unlockedAt: "2024-01-01T00:00:00.000Z" }],
        ]));
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue(["2024-01-01"]);

        const achievements = await achievementService.getAchievements("user-1", "user-2");

        expect(achievements.every((a) => a.league !== null)).toBe(true);
        expect(achievements.find((a) => a.code === "streak")).toBeDefined();
    });

    it("computes the friend's own values, not the requester's", async () => {
        achievementRepoMocks.getTiers.mockResolvedValue(streakTiers());
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        userSeasonRepoMocks.getWatchedDatesByUserId.mockResolvedValue([]);

        await achievementService.getAchievements("user-1", "user-2");

        expect(userSeasonRepoMocks.getWatchedDatesByUserId).toHaveBeenCalledWith("user-2");
        expect(userSeasonRepoMocks.getWatchedDatesByUserId).not.toHaveBeenCalledWith("user-1");
    });
});
