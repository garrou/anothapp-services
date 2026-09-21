import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import UserSeasonRepository from "../../../repositories/userSeasonRepository.js";

vi.mock("../../../config/db.js", () => ({
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

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO users_seasons"), ["user-1", 10, 1, 2, null]
            );
            expect(result).toBe(5);
        });

        it("defaults platform to 999", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{id: 5}]});

            await repo.create("user-1", 10, 1);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10, 1, 999, null]);
        });

        it("passes an explicit addedAt, e.g. to restore an imported viewing's date", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{id: 5}]});

            await repo.create("user-1", 10, 1, 2, "2024-01-01");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10, 1, 2, "2024-01-01"]);
        });

        it("returns null when nothing was inserted", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.create("user-1", 10, 1);

            expect(result).toBeNull();
        });
    });

    describe("findImportedViewing", () => {
        it("returns the id of an already-imported viewing", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{id: 5}]});

            const result = await repo.findImportedViewing("user-1", 10, 1, "2024-01-01");

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("FROM users_seasons"), ["user-1", 10, 1, "2024-01-01"]
            );
            expect(result).toBe(5);
        });

        it("returns null when no matching viewing exists yet", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.findImportedViewing("user-1", 10, 1, "2024-01-01");

            expect(result).toBeNull();
        });

        it("compares added_at null-safely, so a null addedAt can still match", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{id: 5}]});

            await repo.findImportedViewing("user-1", 10, 1, null);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("IS NOT DISTINCT FROM"), ["user-1", 10, 1, null]
            );
        });

        it("compares added_at truncated to milliseconds, so Postgres' extra microsecond precision doesn't break the match", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{id: 5}]});

            await repo.findImportedViewing("user-1", 10, 1, "2024-01-01T00:00:00.000Z");

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("date_trunc('milliseconds', added_at)"),
                ["user-1", 10, 1, "2024-01-01T00:00:00.000Z"]
            );
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

    describe("getViewingTimeByUserIdByShowIdByNumber", () => {
        it("returns the parsed time", async () => {
            db.query.mockResolvedValue({rows: [{time: "50"}]});

            const result = await repo.getViewingTimeByUserIdByShowIdByNumber("user-1", 10, 1);

            expect(result).toBe(50);
        });
    });

    describe("getNbSeasonsByUserIdGroupByYear", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "2024", value: "5"}]});

            const result = await repo.getNbSeasonsByUserIdGroupByYear("user-1");

            expect(result).toEqual([{id: 0, label: "2024", value: 5}]);
        });
    });

    describe("getNbSeasonsByUserIdGroupByMonth", () => {
        it("maps rows to Stat instances with french month labels", async () => {
            db.query.mockResolvedValue({rows: [{num: "2", value: "3"}]});

            const result = await repo.getNbSeasonsByUserIdGroupByMonth("user-1");

            expect(result).toEqual([{id: 0, label: "Février", value: 3}]);
        });
    });

    describe("getTotalSeasonsByUserId", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "6"}]});

            const result = await repo.getTotalSeasonsByUserId("user-1");

            expect(result).toBe(6);
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

    describe("getMaxRewatchCountByUserId", () => {
        it("returns the highest per-season viewing count", async () => {
            db.query.mockResolvedValue({rows: [{max_count: "4"}]});

            const result = await repo.getMaxRewatchCountByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM users_seasons"), ["user-1"]);
            expect(result).toBe(4);
        });

        it("returns 0 when the user has no watched seasons at all", async () => {
            db.query.mockResolvedValue({rows: [{max_count: null}]});

            const result = await repo.getMaxRewatchCountByUserId("user-1");

            expect(result).toBe(0);
        });
    });

    describe("getMostRewatchedByUserId", () => {
        it("returns the show/season watched the most times", async () => {
            db.query.mockResolvedValue({
                rowCount: 1,
                rows: [{show_title: "Friends", season_number: "3", times_watched: "5"}],
            });

            const result = await repo.getMostRewatchedByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("HAVING COUNT(*) > 1"), ["user-1"]);
            expect(result).toEqual({showTitle: "Friends", seasonNumber: 3, timesWatched: 5});
        });

        it("returns null when no season was ever watched more than once", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getMostRewatchedByUserId("user-1");

            expect(result).toBeNull();
        });
    });
});
