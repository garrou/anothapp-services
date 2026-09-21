import { describe, it, expect, vi, beforeEach } from "vitest";
import StatService from "../../../services/statService.js";

const userShowRepoMocks = vi.hoisted(() => ({
    getTotalShowsByUserId: vi.fn(),
    getCountriesByUserId: vi.fn(),
    getNotesByUserId: vi.fn(),
    getKindsByUserId: vi.fn(),
    getNbShowsAddedByUserIdByYear: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getTotalSeasonsByUserId: vi.fn(),
    getNbSeasonsByUserIdGroupByMonthByCurrentYear: vi.fn(),
    getNbSeasonsByUserIdGroupByYear: vi.fn(),
    getNbSeasonsByUserIdGroupByMonth: vi.fn(),
    getPlatformsByUserId: vi.fn(),
    getMostRewatchedByUserId: vi.fn(),
}));
const userEpisodeStatRepoMocks = vi.hoisted(() => ({
    getTimeCurrentMonthByUserId: vi.fn(),
    getTimeCurrentMonthByUserIds: vi.fn(),
    getTotalTimeByUserId: vi.fn(),
    getTotalEpisodesByUserId: vi.fn(),
    getRecordViewingTimeMonth: vi.fn(),
    getRecordViewingTimeDay: vi.fn(),
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
    getUserById: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    checkIfAlreadyFriend: vi.fn(),
    getFriends: vi.fn(),
}));
const userSeasonFriendRepoMocks = vi.hoisted(() => ({
    getTopFriendsByUserId: vi.fn(),
    getTopFriendByUserIdByYear: vi.fn(),
}));

vi.mock("../../../repositories/userShowRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userShowRepoMocks; }),
}));
vi.mock("../../../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../../../repositories/userSeasonFriendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonFriendRepoMocks; }),
}));
vi.mock("../../../repositories/userEpisodeStatRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeStatRepoMocks; }),
}));
vi.mock("../../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../../repositories/friendRepository.js", () => ({
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
        userSeasonRepoMocks.getMostRewatchedByUserId.mockResolvedValue(null);
        userSeasonFriendRepoMocks.getTopFriendsByUserId.mockResolvedValue([]);

        userEpisodeStatRepoMocks.getTimeCurrentMonthByUserId.mockResolvedValue(0);
        userEpisodeStatRepoMocks.getTotalTimeByUserId.mockResolvedValue(0);
        userEpisodeStatRepoMocks.getTotalEpisodesByUserId.mockResolvedValue(0);
        userEpisodeStatRepoMocks.getRecordViewingTimeMonth.mockResolvedValue([]);
        userEpisodeStatRepoMocks.getRecordViewingTimeDay.mockResolvedValue([]);
        userEpisodeStatRepoMocks.getNbEpisodesByUserIdGroupByMonthByCurrentYear.mockResolvedValue([]);
        userEpisodeStatRepoMocks.getTimeHourByUserIdGroupByYear.mockResolvedValue([]);
        userEpisodeStatRepoMocks.getNbEpisodesByUserIdGroupByYear.mockResolvedValue([]);
        userEpisodeStatRepoMocks.getRankingViewingTimeByShows.mockResolvedValue([]);
        userEpisodeStatRepoMocks.getWatchedDatesByUserId.mockResolvedValue([]);
        userEpisodeStatRepoMocks.getWatchedByDay.mockResolvedValue([]);
    });

    it("sources time/episode stats from users_episodes", async () => {
        userEpisodeStatRepoMocks.getTotalEpisodesByUserId.mockResolvedValue(99);
        userEpisodeStatRepoMocks.getWatchedByDay.mockResolvedValue([{ date: "2024-01-01", value: 3 }]);

        const stats = await statService.getStats("user-1");

        expect(stats.nbEpisodes).toBe(99);
        expect(userEpisodeStatRepoMocks.getTotalEpisodesByUserId).toHaveBeenCalledWith("user-1");
        expect(stats.episodesHeatmap).toEqual([{ date: "2024-01-01", value: 3 }]);
    });

    it("always sources season/show-level stats from the same repositories", async () => {
        const stats = await statService.getStats("user-1");

        expect(stats.nbSeasons).toBe(20);
        expect(stats.nbSeries).toBe(10);
        expect(userSeasonRepoMocks.getTotalSeasonsByUserId).toHaveBeenCalledWith("user-1");
    });

    it("computes the current/longest streak from the watched dates", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
        userEpisodeStatRepoMocks.getWatchedDatesByUserId.mockResolvedValue(
            ["2026-08-25", "2026-08-26", "2026-08-27"]
        );

        const stats = await statService.getStats("user-1");

        expect(stats.currentStreak).toBe(3);
        expect(stats.longestStreak).toBe(3);
        expect(userEpisodeStatRepoMocks.getWatchedDatesByUserId).toHaveBeenCalledWith("user-1");

        vi.useRealTimers();
    });

    it("exposes the best day from the viewing-time record", async () => {
        userEpisodeStatRepoMocks.getRecordViewingTimeDay.mockResolvedValue([{ label: "12/03/2024", value: 420 }]);

        const stats = await statService.getStats("user-1");

        expect(stats.bestDay).toEqual({ label: "12/03/2024", value: 420 });
        expect(userEpisodeStatRepoMocks.getRecordViewingTimeDay).toHaveBeenCalledWith("user-1", 1);
    });

    it("exposes the most rewatched show/season", async () => {
        userSeasonRepoMocks.getMostRewatchedByUserId.mockResolvedValue(
            { showTitle: "Friends", seasonNumber: 3, timesWatched: 5 }
        );

        const stats = await statService.getStats("user-1");

        expect(stats.mostRewatched).toEqual({ showTitle: "Friends", seasonNumber: 3, timesWatched: 5 });
        expect(userSeasonRepoMocks.getMostRewatchedByUserId).toHaveBeenCalledWith("user-1");
    });

    it("exposes the top watched-with friends ranking", async () => {
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
        expect(userEpisodeStatRepoMocks.getTotalTimeByUserId).not.toHaveBeenCalled();
    });

    it("returns the friend's stats when friendId is an actual friend", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);

        await statService.getStats("user-1", "user-2");

        expect(friendRepoMocks.checkIfAlreadyFriend).toHaveBeenCalledWith("user-1", "user-2");
        expect(userSeasonRepoMocks.getTotalSeasonsByUserId).toHaveBeenCalledWith("user-2");
    });

    it("skips the friendship check when friendId is the caller's own id", async () => {
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

        userEpisodeStatRepoMocks.getTotalTimeByUserIdByYear.mockResolvedValue(0);
        userEpisodeStatRepoMocks.getTotalEpisodesByUserIdByYear.mockResolvedValue(0);
        userEpisodeStatRepoMocks.getTopShowByUserIdByYear.mockResolvedValue(null);
        userEpisodeStatRepoMocks.getKindsTimeByUserIdByYear.mockResolvedValue(null);
        userEpisodeStatRepoMocks.getTopPlatformByUserIdByYear.mockResolvedValue(null);
        userEpisodeStatRepoMocks.getBestMonthByUserIdByYear.mockResolvedValue(null);
        userEpisodeStatRepoMocks.getWatchedDatesByUserIdByYear.mockResolvedValue([]);
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

    it("sources data from users_episodes", async () => {
        userEpisodeStatRepoMocks.getTotalTimeByUserIdByYear.mockResolvedValue(1234);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.year).toBe(2024);
        expect(wrapped.totalTime).toBe(1234);
        expect(userEpisodeStatRepoMocks.getTotalTimeByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
    });

    it("computes the longest streak of the year from the watched dates", async () => {
        userEpisodeStatRepoMocks.getWatchedDatesByUserIdByYear.mockResolvedValue(
            ["2024-07-01", "2024-07-02", "2024-07-03", "2024-11-20"]
        );

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.bestStreak).toBe(3);
        expect(userEpisodeStatRepoMocks.getWatchedDatesByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
    });

    it("exposes the kind with the most accumulated minutes that year", async () => {
        userEpisodeStatRepoMocks.getKindsTimeByUserIdByYear.mockResolvedValue({id: 0, label: "Thriller", value: 180});

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topKind).toEqual({id: 0, label: "Thriller", value: 180});
    });

    it("returns a null topKind when nothing was watched that year", async () => {
        userEpisodeStatRepoMocks.getKindsTimeByUserIdByYear.mockResolvedValue(null);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topKind).toBeNull();
    });

    it("exposes the top watched-with friend for that year", async () => {
        userSeasonFriendRepoMocks.getTopFriendByUserIdByYear.mockResolvedValue(
            {id: "friend-1", label: "Marie", value: 4}
        );

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topWatchedWithFriend).toEqual({id: "friend-1", label: "Marie", value: 4});
        expect(userSeasonFriendRepoMocks.getTopFriendByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
    });

    it("returns a null topWatchedWithFriend when nobody was tagged that year", async () => {
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
        userEpisodeStatRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map());
    });

    it("ranks participants by minutes watched this month, descending", async () => {
        userEpisodeStatRepoMocks.getTimeCurrentMonthByUserIds.mockResolvedValue(new Map([
            ["user-1", 120],
            ["friend-1", 300],
            ["friend-2", 200],
        ]));

        const leaderboard = await statService.getLeaderboard("user-1");

        expect(userEpisodeStatRepoMocks.getTimeCurrentMonthByUserIds).toHaveBeenCalledWith(["user-1", "friend-1", "friend-2"]);
        expect(leaderboard.map((entry) => entry.id)).toEqual(["friend-1", "friend-2", "user-1"]);
        expect(leaderboard.find((entry) => entry.id === "user-1")).toMatchObject({isMe: true, value: 120});
    });

    it("defaults to 0 minutes for a participant with no viewing this month", async () => {
        const leaderboard = await statService.getLeaderboard("user-1");

        expect(leaderboard).toHaveLength(3);
        leaderboard.forEach((entry) => expect(entry.value).toBe(0));
    });
});
