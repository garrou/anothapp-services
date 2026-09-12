import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserEpisodeRepository from "./userEpisodeRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("UserEpisodeRepository", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserEpisodeRepository();
    });

    describe("getViewedByMonthAgo", () => {
        it("maps rows to EpisodeTimeline instances", async () => {
            db.query.mockResolvedValue({
                rows: [{id: 10, title: "Show", poster: "poster.png", watched_at: "2024-01-01", platform_id: 2, episode_id: 5, episode_title: "Pilot", episode_code: "S01E01", episode_number: 1, episode_global: 1}],
            });

            const result = await repo.getViewedByMonthAgo("user-1", 3);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 3]);
            expect(result).toEqual([{
                showId: 10, showTitle: "Show", showPoster: "poster.png", watchedAt: "2024-01-01", platformId: 2,
                episode: {id: 5, title: "Pilot", code: "S01E01", number: 1, global: 1},
            }]);
        });
    });

    describe("getWatchedTimeByShowIdBySeasonNumber", () => {
        it("returns the parsed time", async () => {
            db.query.mockResolvedValue({rows: [{time: "100"}]});

            const result = await repo.getWatchedTimeByShowIdBySeasonNumber("user-1", 10, 1);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10, 1]);
            expect(result).toBe(100);
        });

        it("returns 0 when there is no data", async () => {
            db.query.mockResolvedValue({rows: [{time: null}]});

            const result = await repo.getWatchedTimeByShowIdBySeasonNumber("user-1", 10, 1);

            expect(result).toBe(0);
        });
    });

    describe("getWatchedTimeAndCountByShowId", () => {
        it("returns [time, episodes, distinctEpisodes] parsed as integers", async () => {
            db.query.mockResolvedValue({rows: [{time: "500", episodes: "10", distinct_episodes: "8"}]});

            const result = await repo.getWatchedTimeAndCountByShowId("user-1", 10);

            expect(result).toEqual([500, 10, 8]);
        });

        it("defaults missing values to 0", async () => {
            db.query.mockResolvedValue({rows: [{time: null, episodes: null, distinct_episodes: null}]});

            const result = await repo.getWatchedTimeAndCountByShowId("user-1", 10);

            expect(result).toEqual([0, 0, 0]);
        });
    });

    describe("create", () => {
        it("returns true when a row was inserted", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.create("user-1", 1, 5, "2024-01-01", 2);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_episodes"), ["user-1", 1, 5, "2024-01-01", 2]);
            expect(result).toBe(true);
        });
    });

    describe("createIfMissing", () => {
        it("returns true when a row was inserted", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.createIfMissing("user-1", 1, 5, "2024-01-01", 2);

            expect(result).toBe(true);
        });

        it("returns false when the row already existed", async () => {
            db.query.mockResolvedValue({rowCount: 0});

            const result = await repo.createIfMissing("user-1", 1, 5, "2024-01-01", 2);

            expect(result).toBe(false);
        });
    });

    describe("existsForViewing", () => {
        it("returns the exists flag", async () => {
            db.query.mockResolvedValue({rows: [{exists: true}]});

            const result = await repo.existsForViewing(1, 5);

            expect(result).toBe(true);
        });
    });

    describe("updateWatchedAt", () => {
        it("returns true when a row was updated", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.updateWatchedAt("user-1", 1, "2024-01-01");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["2024-01-01", 1, "user-1"]);
            expect(result).toBe(true);
        });

        it("returns false when no matching row existed", async () => {
            db.query.mockResolvedValue({rowCount: 0});

            const result = await repo.updateWatchedAt("user-1", 999, "2024-01-01");

            expect(result).toBe(false);
        });
    });

    describe("updatePlatformByUserSeasonId", () => {
        it("calls the update query with the platform and season ids", async () => {
            db.query.mockResolvedValue({});

            await repo.updatePlatformByUserSeasonId(1, 2);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users_episodes"), [2, 1]);
        });
    });

    describe("deleteById", () => {
        it("returns true when a row was deleted", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.deleteById("user-1", 1);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), [1, "user-1"]);
            expect(result).toBe(true);
        });

        it("returns false when no matching row existed", async () => {
            db.query.mockResolvedValue({rowCount: 0});

            const result = await repo.deleteById("user-1", 999);

            expect(result).toBe(false);
        });
    });

    describe("getAllByUserId", () => {
        it("maps rows to {userSeasonId, episode} pairs", async () => {
            db.query.mockResolvedValue({
                rows: [{id: 1, users_seasons_id: 5, episode_id: 10, title: "Pilot", code: "S01E01", number: 1, global: 1, date: "2020-01-01", watched_at: "2024-01-01"}],
            });

            const result = await repo.getAllByUserId("user-1");

            expect(result).toEqual([{
                userSeasonId: 5,
                episode: {id: 1, episodeId: 10, title: "Pilot", code: "S01E01", number: 1, global: 1, date: "2020-01-01", description: undefined, watchedAt: "2024-01-01"},
            }]);
        });
    });

    describe("getByUserSeasonId", () => {
        it("maps rows to UserEpisode instances", async () => {
            db.query.mockResolvedValue({
                rows: [{id: null, episode_id: 10, title: "Pilot", code: "S01E01", number: 1, global: 1, date: "2020-01-01", description: "desc", watched_at: null}],
            });

            const result = await repo.getByUserSeasonId(5, 10, 1);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), [5, 10, 1]);
            expect(result).toEqual([{id: null, episodeId: 10, title: "Pilot", code: "S01E01", number: 1, global: 1, date: "2020-01-01", description: "desc", watchedAt: null}]);
        });
    });
});
