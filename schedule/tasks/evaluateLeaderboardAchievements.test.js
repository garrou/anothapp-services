import { describe, it, expect, vi, beforeEach } from "vitest";
import evaluateLeaderboardAchievements from "./evaluateLeaderboardAchievements.js";

const userRepoMocks = vi.hoisted(() => ({
    getAllUserIds: vi.fn(),
    getEpisodeTrackingByIds: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    getFriends: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getTimeCurrentMonthByUserIds: vi.fn(),
}));
const userEpisodeStatRepoMocks = vi.hoisted(() => ({
    getTimeCurrentMonthByUserIds: vi.fn(),
}));
const achievementServiceMocks = vi.hoisted(() => ({
    unlockLeaderboardTop3: vi.fn(),
}));

vi.mock("../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));
vi.mock("../../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../../repositories/userEpisodeStatRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeStatRepoMocks; }),
}));
vi.mock("../../services/achievementService.js", () => ({
    default: vi.fn().mockImplementation(function () { return achievementServiceMocks; }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    userEpisodeStatRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map());
});

describe("evaluateLeaderboardAchievements", () => {
    it("unlocks the achievement for a user ranked in the top 3 of their own friends", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1"]);
        friendRepoMocks.getFriends.mockResolvedValue([{ id: "friend-1" }, { id: "friend-2" }]);
        userRepoMocks.getEpisodeTrackingByIds.mockResolvedValue(new Map());
        userSeasonRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map([
            ["user-1", 500], ["friend-1", 100], ["friend-2", 50],
        ]));

        const result = await evaluateLeaderboardAchievements();

        expect(achievementServiceMocks.unlockLeaderboardTop3).toHaveBeenCalledWith("user-1");
        expect(result).toEqual({ unlocked: 1, failed: [] });
    });

    it("does not unlock when the user has no viewing time this month", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1"]);
        friendRepoMocks.getFriends.mockResolvedValue([]);
        userRepoMocks.getEpisodeTrackingByIds.mockResolvedValue(new Map());
        userSeasonRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map());

        const result = await evaluateLeaderboardAchievements();

        expect(achievementServiceMocks.unlockLeaderboardTop3).not.toHaveBeenCalled();
        expect(result).toEqual({ unlocked: 0, failed: [] });
    });

    it("does not unlock a user ranked below the top 3 among their friends", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1"]);
        friendRepoMocks.getFriends.mockResolvedValue([
            { id: "f1" }, { id: "f2" }, { id: "f3" },
        ]);
        userRepoMocks.getEpisodeTrackingByIds.mockResolvedValue(new Map());
        userSeasonRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map([
            ["user-1", 10], ["f1", 100], ["f2", 90], ["f3", 80],
        ]));

        const result = await evaluateLeaderboardAchievements();

        expect(achievementServiceMocks.unlockLeaderboardTop3).not.toHaveBeenCalled();
        expect(result).toEqual({ unlocked: 0, failed: [] });
    });

    it("reports a failure for one user without stopping the others", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1", "user-2"]);
        friendRepoMocks.getFriends
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce([]);
        userRepoMocks.getEpisodeTrackingByIds.mockResolvedValue(new Map());
        userSeasonRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map([["user-2", 10]]));

        const result = await evaluateLeaderboardAchievements();

        expect(result.unlocked).toBe(1);
        expect(result.failed).toEqual([{ userId: "user-1", error: "boom" }]);
    });
});
