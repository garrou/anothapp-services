import { describe, it, expect, vi, beforeEach } from "vitest";
import StatService from "./statService.js";

const userShowRepoMocks = vi.hoisted(() => ({
    getTotalShowsByUserId: vi.fn(),
    getCountriesByUserId: vi.fn(),
    getNotesByUserId: vi.fn(),
    getKindsByUserId: vi.fn(),
    getNbShowsAddedByUserIdByYear: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getTimeCurrentMonthByUserId: vi.fn(),
    getTotalTimeByUserId: vi.fn(),
    getTotalSeasonsByUserId: vi.fn(),
    getTotalEpisodesByUserId: vi.fn(),
    getRecordViewingTimeMonth: vi.fn(),
    getNbSeasonsByUserIdGroupByMonthByCurrentYear: vi.fn(),
    getNbEpisodesByUserIdGroupByMonthByCurrentYear: vi.fn(),
    getTimeHourByUserIdGroupByYear: vi.fn(),
    getNbSeasonsByUserIdGroupByYear: vi.fn(),
    getNbEpisodesByUserIdGroupByYear: vi.fn(),
    getNbSeasonsByUserIdGroupByMonth: vi.fn(),
    getRankingViewingTimeByShows: vi.fn(),
    getPlatformsByUserId: vi.fn(),
    getWatchedDatesByUserId: vi.fn(),
    getTotalTimeByUserIdByYear: vi.fn(),
    getTotalEpisodesByUserIdByYear: vi.fn(),
    getTopShowByUserIdByYear: vi.fn(),
    getKindsTimeByUserIdByYear: vi.fn(),
    getTopPlatformByUserIdByYear: vi.fn(),
    getBestMonthByUserIdByYear: vi.fn(),
    getWatchedDatesByUserIdByYear: vi.fn(),
    getTimeCurrentMonthByUserIds: vi.fn(),
}));
const userEpisodeStatRepoMocks = vi.hoisted(() => ({
    getTimeCurrentMonthByUserId: vi.fn(),
    getTimeCurrentMonthByUserIds: vi.fn(),
    getTotalTimeByUserId: vi.fn(),
    getTotalEpisodesByUserId: vi.fn(),
    getRecordViewingTimeMonth: vi.fn(),
    getNbEpisodesByUserIdGroupByMonthByCurrentYear: vi.fn(),
    getTotalTimeByUserIdByYear: vi.fn(),
    getTotalEpisodesByUserIdByYear: vi.fn(),
    getTopShowByUserIdByYear: vi.fn(),
    getKindsTimeByUserIdByYear: vi.fn(),
    getTopPlatformByUserIdByYear: vi.fn(),
    getBestMonthByUserIdByYear: vi.fn(),
    getTimeHourByUserIdGroupByYear: vi.fn(),
    getNbEpisodesByUserIdGroupByYear: vi.fn(),
    getRankingViewingTimeByShows: vi.fn(),
    getWatchedByDay: vi.fn(),
    getWatchedDatesByUserId: vi.fn(),
    getWatchedDatesByUserIdByYear: vi.fn(),
}));
const userRepoMocks = vi.hoisted(() => ({
    hasEpisodeTrackingEnabled: vi.fn(),
    getUserById: vi.fn(),
    getEpisodeTrackingByIds: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    checkIfAlreadyFriend: vi.fn(),
    getFriends: vi.fn(),
}));
const userSeasonFriendRepoMocks = vi.hoisted(() => ({
    getTopFriendsByUserId: vi.fn(),
    getTopFriendByUserIdByYear: vi.fn(),
}));

vi.mock("../repositories/userShowRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userShowRepoMocks; }),
}));
vi.mock("../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../repositories/userSeasonFriendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonFriendRepoMocks; }),
}));
vi.mock("../repositories/userEpisodeStatRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeStatRepoMocks; }),
}));
vi.mock("../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));

describe("StatService.getStats", () => {
    let statService;

    beforeEach(() => {
        vi.clearAllMocks();
        statService = new StatService();

        userShowRepoMocks.getTotalShowsByUserId.mockResolvedValue(10);
        userShowRepoMocks.getCountriesByUserId.mockResolvedValue([]);
        userShowRepoMocks.getNotesByUserId.mockResolvedValue([]);
        userShowRepoMocks.getKindsByUserId.mockResolvedValue([]);
        userSeasonRepoMocks.getTotalSeasonsByUserId.mockResolvedValue(20);
        userSeasonRepoMocks.getNbSeasonsByUserIdGroupByMonthByCurrentYear.mockResolvedValue([]);
        userSeasonRepoMocks.getNbSeasonsByUserIdGroupByYear.mockResolvedValue([]);
        userSeasonRepoMocks.getNbSeasonsByUserIdGroupByMonth.mockResolvedValue([]);
        userSeasonRepoMocks.getPlatformsByUserId.mockResolvedValue([]);
        userSeasonRepoMocks.getRecordViewingTimeMonth.mockResolvedValue([]);
        userSeasonFriendRepoMocks.getTopFriendsByUserId.mockResolvedValue([]);

        for (const repo of [userSeasonRepoMocks, userEpisodeStatRepoMocks]) {
            repo.getTimeCurrentMonthByUserId.mockResolvedValue(0);
            repo.getTotalTimeByUserId.mockResolvedValue(0);
            repo.getTotalEpisodesByUserId.mockResolvedValue(0);
            repo.getRecordViewingTimeMonth.mockResolvedValue([]);
            repo.getNbEpisodesByUserIdGroupByMonthByCurrentYear.mockResolvedValue([]);
            repo.getTimeHourByUserIdGroupByYear.mockResolvedValue([]);
            repo.getNbEpisodesByUserIdGroupByYear.mockResolvedValue([]);
            repo.getRankingViewingTimeByShows.mockResolvedValue([]);
            repo.getWatchedDatesByUserId.mockResolvedValue([]);
        }
    });

    it("sources time/episode stats from users_seasons when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userSeasonRepoMocks.getTotalEpisodesByUserId.mockResolvedValue(42);

        const stats = await statService.getStats("user-1");

        expect(stats.nbEpisodes).toBe(42);
        expect(userSeasonRepoMocks.getTotalEpisodesByUserId).toHaveBeenCalledWith("user-1");
        expect(userEpisodeStatRepoMocks.getTotalEpisodesByUserId).not.toHaveBeenCalled();
        expect(stats.episodesHeatmap).toBeUndefined();
    });

    it("sources time/episode stats from users_episodes when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getTotalEpisodesByUserId.mockResolvedValue(99);
        userEpisodeStatRepoMocks.getWatchedByDay.mockResolvedValue([{ date: "2024-01-01", value: 3 }]);

        const stats = await statService.getStats("user-1");

        expect(stats.nbEpisodes).toBe(99);
        expect(userEpisodeStatRepoMocks.getTotalEpisodesByUserId).toHaveBeenCalledWith("user-1");
        expect(userSeasonRepoMocks.getTotalEpisodesByUserId).not.toHaveBeenCalled();
        expect(stats.episodesHeatmap).toEqual([{ date: "2024-01-01", value: 3 }]);
    });

    it("always sources season/show-level stats from the same repositories regardless of the flag", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);

        const stats = await statService.getStats("user-1");

        expect(stats.nbSeasons).toBe(20);
        expect(stats.nbSeries).toBe(10);
        expect(userSeasonRepoMocks.getTotalSeasonsByUserId).toHaveBeenCalledWith("user-1");
    });

    it("computes the current/longest streak from the watched dates of the active repo", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getWatchedDatesByUserId.mockResolvedValue(
            ["2026-08-25", "2026-08-26", "2026-08-27"]
        );

        const stats = await statService.getStats("user-1");

        expect(stats.currentStreak).toBe(3);
        expect(stats.longestStreak).toBe(3);
        expect(userEpisodeStatRepoMocks.getWatchedDatesByUserId).toHaveBeenCalledWith("user-1");
        expect(userSeasonRepoMocks.getWatchedDatesByUserId).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("exposes the top watched-with friends ranking", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userSeasonFriendRepoMocks.getTopFriendsByUserId.mockResolvedValue([
            {id: "friend-1", label: "Marie", value: 5}
        ]);

        const stats = await statService.getStats("user-1");

        expect(stats.topWatchedWithFriends).toEqual([{id: "friend-1", label: "Marie", value: 5}]);
        expect(userSeasonFriendRepoMocks.getTopFriendsByUserId).toHaveBeenCalledWith("user-1", 5);
    });

    it("rejects with a 400 when requesting a friendId that isn't actually a friend", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(
            statService.getStats("user-1", "user-2")
        ).rejects.toThrow("Vous n'êtes pas en relation avec cette personne");
        expect(userRepoMocks.hasEpisodeTrackingEnabled).not.toHaveBeenCalled();
    });

    it("returns the friend's stats when friendId is an actual friend", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);

        await statService.getStats("user-1", "user-2");

        expect(friendRepoMocks.checkIfAlreadyFriend).toHaveBeenCalledWith("user-1", "user-2");
        expect(userSeasonRepoMocks.getTotalSeasonsByUserId).toHaveBeenCalledWith("user-2");
    });

    it("skips the friendship check when friendId is the caller's own id", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);

        await statService.getStats("user-1", "user-1");

        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });
});

describe("StatService.getWrapped", () => {
    let statService;

    beforeEach(() => {
        vi.clearAllMocks();
        statService = new StatService();
        userShowRepoMocks.getNbShowsAddedByUserIdByYear.mockResolvedValue(0);
        userSeasonFriendRepoMocks.getTopFriendByUserIdByYear.mockResolvedValue(null);

        for (const repo of [userSeasonRepoMocks, userEpisodeStatRepoMocks]) {
            repo.getTotalTimeByUserIdByYear.mockResolvedValue(0);
            repo.getTotalEpisodesByUserIdByYear.mockResolvedValue(0);
            repo.getTopShowByUserIdByYear.mockResolvedValue(null);
            repo.getKindsTimeByUserIdByYear.mockResolvedValue(null);
            repo.getTopPlatformByUserIdByYear.mockResolvedValue(null);
            repo.getBestMonthByUserIdByYear.mockResolvedValue(null);
            repo.getWatchedDatesByUserIdByYear.mockResolvedValue([]);
        }
    });

    it("rejects a non-numeric year", async () => {
        await expect(statService.getWrapped("user-1", "abc")).rejects.toThrow("Requête invalide");
    });

    it("rejects a year before 2000", async () => {
        await expect(statService.getWrapped("user-1", 1999)).rejects.toThrow("Requête invalide");
    });

    it("rejects a year in the future", async () => {
        await expect(statService.getWrapped("user-1", new Date().getFullYear() + 1)).rejects.toThrow("Requête invalide");
    });

    it("sources data from users_episodes when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getTotalTimeByUserIdByYear.mockResolvedValue(1234);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.year).toBe(2024);
        expect(wrapped.totalTime).toBe(1234);
        expect(userEpisodeStatRepoMocks.getTotalTimeByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
        expect(userSeasonRepoMocks.getTotalTimeByUserIdByYear).not.toHaveBeenCalled();
    });

    it("computes the longest streak of the year from the watched dates of the active repo", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getWatchedDatesByUserIdByYear.mockResolvedValue(
            ["2024-07-01", "2024-07-02", "2024-07-03", "2024-11-20"]
        );

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.bestStreak).toBe(3);
        expect(userEpisodeStatRepoMocks.getWatchedDatesByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
        expect(userSeasonRepoMocks.getWatchedDatesByUserIdByYear).not.toHaveBeenCalled();
    });

    it("sources data from users_seasons when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userSeasonRepoMocks.getTotalTimeByUserIdByYear.mockResolvedValue(5678);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.totalTime).toBe(5678);
        expect(userSeasonRepoMocks.getTotalTimeByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
        expect(userEpisodeStatRepoMocks.getTotalTimeByUserIdByYear).not.toHaveBeenCalled();
    });

    it("exposes the kind with the most accumulated minutes that year", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getKindsTimeByUserIdByYear.mockResolvedValue({id: 0, label: "Thriller", value: 180});

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topKind).toEqual({id: 0, label: "Thriller", value: 180});
    });

    it("returns a null topKind when nothing was watched that year", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getKindsTimeByUserIdByYear.mockResolvedValue(null);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topKind).toBeNull();
    });

    it("exposes the top watched-with friend for that year", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userSeasonFriendRepoMocks.getTopFriendByUserIdByYear.mockResolvedValue(
            {id: "friend-1", label: "Marie", value: 4}
        );

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topWatchedWithFriend).toEqual({id: "friend-1", label: "Marie", value: 4});
        expect(userSeasonFriendRepoMocks.getTopFriendByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
    });

    it("returns a null topWatchedWithFriend when nobody was tagged that year", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topWatchedWithFriend).toBeNull();
    });
});

describe("StatService.getLeaderboard", () => {
    let statService;

    beforeEach(() => {
        vi.clearAllMocks();
        statService = new StatService();
        userRepoMocks.getUserById.mockResolvedValue({id: "user-1", username: "Moi", picture: undefined});
        friendRepoMocks.getFriends.mockResolvedValue([
            {id: "friend-1", username: "Marie", picture: undefined},
            {id: "friend-2", username: "Paul", picture: undefined},
        ]);
        userRepoMocks.getEpisodeTrackingByIds.mockResolvedValue(new Map([
            ["user-1", false],
            ["friend-1", false],
            ["friend-2", true],
        ]));
        userSeasonRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map());
        userEpisodeStatRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map());
    });

    it("splits participants between the season and episode repos by their tracking mode", async () => {
        await statService.getLeaderboard("user-1");

        expect(userSeasonRepoMocks.getTimeCurrentMonthByUserIds).toHaveBeenCalledWith(["user-1", "friend-1"]);
        expect(userEpisodeStatRepoMocks.getTimeCurrentMonthByUserIds).toHaveBeenCalledWith(["friend-2"]);
    });

    it("ranks participants by minutes watched this month, descending", async () => {
        userSeasonRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map([
            ["user-1", 120],
            ["friend-1", 300],
        ]));
        userEpisodeStatRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map([
            ["friend-2", 200],
        ]));

        const leaderboard = await statService.getLeaderboard("user-1");

        expect(leaderboard.map((entry) => entry.id)).toEqual(["friend-1", "friend-2", "user-1"]);
        expect(leaderboard.find((entry) => entry.id === "user-1")).toMatchObject({isMe: true, value: 120});
    });

    it("defaults to 0 minutes for a participant with no viewing this month", async () => {
        const leaderboard = await statService.getLeaderboard("user-1");

        expect(leaderboard).toHaveLength(3);
        leaderboard.forEach((entry) => expect(entry.value).toBe(0));
    });
});
