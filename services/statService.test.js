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
    getTotalTimeByUserIdByYear: vi.fn(),
    getTotalEpisodesByUserIdByYear: vi.fn(),
    getTopShowByUserIdByYear: vi.fn(),
    getKindsTimeByUserIdByYear: vi.fn(),
    getTopPlatformByUserIdByYear: vi.fn(),
    getBestMonthByUserIdByYear: vi.fn(),
}));
const userEpisodeStatRepoMocks = vi.hoisted(() => ({
    getTimeCurrentMonthByUserId: vi.fn(),
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
}));
const userRepoMocks = vi.hoisted(() => ({
    hasEpisodeTrackingEnabled: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    checkIfAlreadyFriend: vi.fn(),
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

        for (const repo of [userSeasonRepoMocks, userEpisodeStatRepoMocks]) {
            repo.getTimeCurrentMonthByUserId.mockResolvedValue(0);
            repo.getTotalTimeByUserId.mockResolvedValue(0);
            repo.getTotalEpisodesByUserId.mockResolvedValue(0);
            repo.getRecordViewingTimeMonth.mockResolvedValue([]);
            repo.getNbEpisodesByUserIdGroupByMonthByCurrentYear.mockResolvedValue([]);
            repo.getTimeHourByUserIdGroupByYear.mockResolvedValue([]);
            repo.getNbEpisodesByUserIdGroupByYear.mockResolvedValue([]);
            repo.getRankingViewingTimeByShows.mockResolvedValue([]);
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

        for (const repo of [userSeasonRepoMocks, userEpisodeStatRepoMocks]) {
            repo.getTotalTimeByUserIdByYear.mockResolvedValue(0);
            repo.getTotalEpisodesByUserIdByYear.mockResolvedValue(0);
            repo.getTopShowByUserIdByYear.mockResolvedValue(null);
            repo.getKindsTimeByUserIdByYear.mockResolvedValue([]);
            repo.getTopPlatformByUserIdByYear.mockResolvedValue(null);
            repo.getBestMonthByUserIdByYear.mockResolvedValue(null);
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

    it("sources data from users_seasons when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userSeasonRepoMocks.getTotalTimeByUserIdByYear.mockResolvedValue(5678);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.totalTime).toBe(5678);
        expect(userSeasonRepoMocks.getTotalTimeByUserIdByYear).toHaveBeenCalledWith("user-1", 2024);
        expect(userEpisodeStatRepoMocks.getTotalTimeByUserIdByYear).not.toHaveBeenCalled();
    });

    it("picks the kind with the most accumulated minutes across shows", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userEpisodeStatRepoMocks.getKindsTimeByUserIdByYear.mockResolvedValue([
            {kinds: "Drame;Thriller", value: 100},
            {kinds: "Comédie", value: 50},
            {kinds: "Thriller", value: 80},
        ]);

        const wrapped = await statService.getWrapped("user-1", 2024);

        // Thriller: 100 + 80 = 180, Drame: 100, Comédie: 50
        expect(wrapped.topKind).toEqual({id: 0, label: "Thriller", value: 180});
    });

    it("returns a null topKind when nothing was watched that year", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);

        const wrapped = await statService.getWrapped("user-1", 2024);

        expect(wrapped.topKind).toBeNull();
    });
});
