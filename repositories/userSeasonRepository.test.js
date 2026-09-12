import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserSeasonRepository from "./userSeasonRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("UserSeasonRepository", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonRepository();
    });

    describe("create", () => {
        it("returns the created row's id", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{id: 5}]});

            const result = await repo.create("user-1", 10, 1, 2);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_seasons"), ["user-1", 10, 1, 2]);
            expect(result).toBe(5);
        });

        it("defaults platform to 999", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{id: 5}]});

            await repo.create("user-1", 10, 1);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10, 1, 999]);
        });

        it("returns null when nothing was inserted", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.create("user-1", 10, 1);

            expect(result).toBeNull();
        });
    });

    describe("getOwnedSeasonViewing", () => {
        it("returns the viewing details when owned", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{show_id: 10, number: 1, platform_id: 2}]});

            const result = await repo.getOwnedSeasonViewing("user-1", 5);

            expect(result).toEqual({showId: 10, number: 1, platformId: 2});
        });

        it("returns null when not owned or not found", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getOwnedSeasonViewing("user-1", 999);

            expect(result).toBeNull();
        });
    });

    describe("getDistinctByUserIdByShowId", () => {
        it("maps rows to Season instances with cumulated episode intervals", async () => {
            db.query.mockResolvedValue({rows: [{number: 1, image: "img1.png", episodes: 8}, {number: 2, image: "img2.png", episodes: 10}]});

            const result = await repo.getDistinctByUserIdByShowId("user-1", 10);

            expect(result).toEqual([
                {number: 1, episodes: 8, image: "img1.png", interval: "1 - 8"},
                {number: 2, episodes: 10, image: "img2.png", interval: "9 - 18"},
            ]);
        });
    });

    describe("getUserSeasonsByUserId", () => {
        it("maps rows to UserSeason instances", async () => {
            db.query.mockResolvedValue({rows: [{id: 1, added_at: "2024-01-01", show_id: 10, number: 1, platform_id: 2, platform: "Netflix"}]});

            const result = await repo.getUserSeasonsByUserId("user-1");

            expect(result).toEqual([{id: 1, number: 1, addedAt: "2024-01-01", platform: "Netflix", platformId: 2, showId: 10}]);
        });
    });

    describe("getInfosByUserIdByShowId", () => {
        it("maps rows to PartialUserSeason instances enriched with watchedWith", async () => {
            db.query.mockResolvedValue({rows: [{id: 1, added_at: "2024-01-01", pid: 2, name: "Netflix", logo: "netflix.png"}]});
            repo._userSeasonFriendRepository.getByUserSeasonIds = vi.fn().mockResolvedValue(new Map([[1, [{id: "user-2", username: "bob"}]]]));

            const result = await repo.getInfosByUserIdByShowId("user-1", 10, 1);

            expect(repo._userSeasonFriendRepository.getByUserSeasonIds).toHaveBeenCalledWith([1]);
            expect(result).toEqual([{
                id: 1, addedAt: "2024-01-01",
                platform: {id: 2, name: "Netflix", logo: "netflix.png"},
                watchedWith: [{id: "user-2", username: "bob"}],
            }]);
        });

        it("defaults watchedWith to an empty array when there is no match", async () => {
            db.query.mockResolvedValue({rows: [{id: 1, added_at: "2024-01-01", pid: null, name: null, logo: null}]});
            repo._userSeasonFriendRepository.getByUserSeasonIds = vi.fn().mockResolvedValue(new Map());

            const result = await repo.getInfosByUserIdByShowId("user-1", 10, 1);

            expect(result[0].watchedWith).toEqual([]);
        });
    });

    describe("getTimeEpisodesByUserIdByShowId", () => {
        it("returns [time, episodes] parsed as integers", async () => {
            db.query.mockResolvedValue({rows: [{time: "500", episodes: "10"}]});

            const result = await repo.getTimeEpisodesByUserIdByShowId("user-1", 10);

            expect(result).toEqual([500, 10]);
        });
    });

    describe("getViewingTimeByUserIdByShowIdByNumber", () => {
        it("returns the parsed time", async () => {
            db.query.mockResolvedValue({rows: [{time: "50"}]});

            const result = await repo.getViewingTimeByUserIdByShowIdByNumber("user-1", 10, 1);

            expect(result).toBe(50);
        });
    });

    describe("getTotalTimeByUserId", () => {
        it("returns the parsed total time", async () => {
            db.query.mockResolvedValue({rows: [{time: "1000"}]});

            const result = await repo.getTotalTimeByUserId("user-1");

            expect(result).toBe(1000);
        });

        it("returns 0 when there is no data", async () => {
            db.query.mockResolvedValue({rows: [{time: null}]});

            const result = await repo.getTotalTimeByUserId("user-1");

            expect(result).toBe(0);
        });
    });

    describe("getNbSeasonsByUserIdGroupByYear", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "2024", value: "5"}]});

            const result = await repo.getNbSeasonsByUserIdGroupByYear("user-1");

            expect(result).toEqual([{id: 0, label: "2024", value: 5}]);
        });
    });

    describe("getTimeHourByUserIdGroupByYear", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "2024", value: "20"}]});

            const result = await repo.getTimeHourByUserIdGroupByYear("user-1");

            expect(result).toEqual([{id: 0, label: "2024", value: 20}]);
        });
    });

    describe("getTimeCurrentMonthByUserId", () => {
        it("returns the parsed time", async () => {
            db.query.mockResolvedValue({rows: [{time: "60"}]});

            const result = await repo.getTimeCurrentMonthByUserId("user-1");

            expect(result).toBe(60);
        });
    });

    describe("getTimeCurrentMonthByUserIds", () => {
        it("returns an empty Map without querying when userIds is empty", async () => {
            const result = await repo.getTimeCurrentMonthByUserIds([]);

            expect(db.query).not.toHaveBeenCalled();
            expect(result.size).toBe(0);
        });

        it("returns a Map keyed by user id", async () => {
            db.query.mockResolvedValue({rows: [{user_id: "user-1", time: "90"}]});

            const result = await repo.getTimeCurrentMonthByUserIds(["user-1"]);

            expect(result.get("user-1")).toBe(90);
        });
    });

    describe("getNbSeasonsByUserIdGroupByMonth", () => {
        it("maps rows to Stat instances with french month labels", async () => {
            db.query.mockResolvedValue({rows: [{num: "2", value: "3"}]});

            const result = await repo.getNbSeasonsByUserIdGroupByMonth("user-1");

            expect(result).toEqual([{id: 0, label: "Février", value: 3}]);
        });
    });

    describe("getNbEpisodesByUserIdGroupByYear", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "2024", value: "12"}]});

            const result = await repo.getNbEpisodesByUserIdGroupByYear("user-1");

            expect(result).toEqual([{id: 0, label: "2024", value: 12}]);
        });
    });

    describe("getTotalEpisodesByUserId", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "40"}]});

            const result = await repo.getTotalEpisodesByUserId("user-1");

            expect(result).toBe(40);
        });
    });

    describe("getTotalSeasonsByUserId", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "6"}]});

            const result = await repo.getTotalSeasonsByUserId("user-1");

            expect(result).toBe(6);
        });
    });

    describe("getViewedByMonthAgo", () => {
        it("maps rows to SeasonTimeline instances", async () => {
            db.query.mockResolvedValue({rows: [{id: 10, title: "Show", poster: "poster.png", image: "img.png", episodes: 8, number: 1, added_at: "2024-01-01", platform_id: 2}]});

            const result = await repo.getViewedByMonthAgo("user-1", 3);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 3]);
            expect(result).toEqual([{showId: 10, showTitle: "Show", addedAt: "2024-01-01", platformId: 2, season: {number: 1, episodes: 8, image: "img.png", interval: ""}}]);
        });
    });

    describe("getRankingViewingTimeByShows", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "Show", value: "30"}]});

            const result = await repo.getRankingViewingTimeByShows("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10]);
            expect(result).toEqual([{id: 0, label: "Show", value: 30}]);
        });
    });

    describe("getRecordViewingTimeMonth", () => {
        it("reverses the rows and maps to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "02/2024", value: "20"}, {label: "01/2024", value: "40"}]});

            const result = await repo.getRecordViewingTimeMonth("user-1");

            expect(result).toEqual([{id: 0, label: "01/2024", value: 40}, {id: 0, label: "02/2024", value: 20}]);
        });
    });

    describe("getSeasonsByAddedYear", () => {
        it("maps rows to Season instances", async () => {
            db.query.mockResolvedValue({rows: [{show_id: 10, number: 1, episodes: 8, image: "img.png"}]});

            const result = await repo.getSeasonsByAddedYear("user-1", 2024);

            expect(result).toEqual([{number: 1, episodes: 8, image: "img.png", interval: ""}]);
        });
    });

    describe("getNbSeasonsByUserIdGroupByMonthByCurrentYear", () => {
        it("maps rows to Stat instances with french month labels", async () => {
            db.query.mockResolvedValue({rows: [{num: "4", value: "2"}]});

            const result = await repo.getNbSeasonsByUserIdGroupByMonthByCurrentYear("user-1");

            expect(result).toEqual([{id: 0, label: "Avril", value: 2}]);
        });
    });

    describe("getNbEpisodesByUserIdGroupByMonthByCurrentYear", () => {
        it("maps rows to Stat instances with french month labels", async () => {
            db.query.mockResolvedValue({rows: [{num: "5", value: "9"}]});

            const result = await repo.getNbEpisodesByUserIdGroupByMonthByCurrentYear("user-1");

            expect(result).toEqual([{id: 0, label: "Mai", value: 9}]);
        });
    });

    describe("getTotalTimeByUserIdByYear", () => {
        it("returns the parsed time", async () => {
            db.query.mockResolvedValue({rows: [{time: "300"}]});

            const result = await repo.getTotalTimeByUserIdByYear("user-1", 2024);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 2024]);
            expect(result).toBe(300);
        });
    });

    describe("getTotalEpisodesByUserIdByYear", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "15"}]});

            const result = await repo.getTotalEpisodesByUserIdByYear("user-1", 2024);

            expect(result).toBe(15);
        });
    });

    describe("getTopShowByUserIdByYear", () => {
        it("returns a Stat when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{label: "Show", value: "600"}]});

            const result = await repo.getTopShowByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Show", value: 600});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getTopShowByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getKindsTimeByUserIdByYear", () => {
        it("returns a Stat when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{label: "Drame", value: "400"}]});

            const result = await repo.getKindsTimeByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Drame", value: 400});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getKindsTimeByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getTopPlatformByUserIdByYear", () => {
        it("returns a Stat when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{label: "Netflix", value: "8"}]});

            const result = await repo.getTopPlatformByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Netflix", value: 8});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getTopPlatformByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getBestMonthByUserIdByYear", () => {
        it("returns a Stat with the french month label when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{num: "6", value: "250"}]});

            const result = await repo.getBestMonthByUserIdByYear("user-1", 2024);

            expect(result).toEqual({id: 0, label: "Juin", value: 250});
        });

        it("returns null when nothing matched", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getBestMonthByUserIdByYear("user-1", 2024);

            expect(result).toBeNull();
        });
    });

    describe("getPlatformsByUserId", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "Netflix", value: "10"}]});

            const result = await repo.getPlatformsByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10]);
            expect(result).toEqual([{id: 0, label: "Netflix", value: 10}]);
        });
    });

    describe("getPlatformsCountByUserId", () => {
        it("returns the parsed count", async () => {
            db.query.mockResolvedValue({rows: [{total: "3"}]});

            const result = await repo.getPlatformsCountByUserId("user-1");

            expect(result).toBe(3);
        });
    });

    describe("getWatchedDatesByUserId", () => {
        it("returns the list of dates", async () => {
            db.query.mockResolvedValue({rows: [{date: "2024-01-01"}]});

            const result = await repo.getWatchedDatesByUserId("user-1");

            expect(result).toEqual(["2024-01-01"]);
        });
    });

    describe("getWatchedDatesByUserIdByYear", () => {
        it("returns the list of dates", async () => {
            db.query.mockResolvedValue({rows: [{date: "2024-01-01"}]});

            const result = await repo.getWatchedDatesByUserIdByYear("user-1", 2024);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 2024]);
            expect(result).toEqual(["2024-01-01"]);
        });
    });
});
