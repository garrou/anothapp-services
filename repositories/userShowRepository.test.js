import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserShowRepository from "./userShowRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

const showRow = {id: 10, title: "Show", poster: "poster.png", kind_names: ["Drame"], favorite: false, duration: 42, added_at: "2024-01-01", country: "FR", continue: true, seasons: 1, note_id: null, finished: false, next_episode: null, description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8};

describe("UserShowRepository", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserShowRepository();
    });

    describe("checkShowExistsByUserIdByShowId", () => {
        it("returns the exists flag", async () => {
            db.query.mockResolvedValue({rows: [{exists: true}]});

            const result = await repo.checkShowExistsByUserIdByShowId("user-1", 10);

            expect(result).toBe(true);
        });
    });

    describe("create", () => {
        it("returns true when a row was inserted", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.create("user-1", 10);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_shows"), ["user-1", 10]);
            expect(result).toBe(true);
        });
    });

    describe("deleteByUserIdShowId", () => {
        it("returns true when a row was deleted", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.deleteByUserIdShowId("user-1", 10);

            expect(result).toBe(true);
        });

        it("returns false when no matching row existed", async () => {
            db.query.mockResolvedValue({rowCount: 0});

            const result = await repo.deleteByUserIdShowId("user-1", 999);

            expect(result).toBe(false);
        });
    });

    describe("getShowsByUserId", () => {
        it("maps rows to UserShow instances and passes filter params", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsByUserId("user-1", "Show", [1], ["FR"], ["Drama"], [2], ["user-2"]);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", "%Show%", [1], ["FR"], [2], ["Drama"], ["user-2"]]);
            expect(result).toEqual([expect.objectContaining({id: 10, title: "Show"})]);
        });

        it("passes null title and defaults friendIds to an empty array", async () => {
            db.query.mockResolvedValue({rows: []});

            await repo.getShowsByUserId("user-1", null, [], [], [], []);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", null, [], [], [], [], []]);
        });
    });

    describe("getShowByUserIdByShowId", () => {
        it("returns a UserShow when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [showRow]});

            const result = await repo.getShowByUserIdByShowId("user-1", 10);

            expect(result.id).toBe(10);
        });

        it("returns null when not found", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getShowByUserIdByShowId("user-1", 999);

            expect(result).toBeNull();
        });
    });

    describe("getTotalShowsByUserId", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "20"}]});

            const result = await repo.getTotalShowsByUserId("user-1");

            expect(result).toBe(20);
        });
    });

    describe("getTotalCompletedShowsByUserId", () => {
        it("returns the parsed total", async () => {
            db.query.mockResolvedValue({rows: [{total: "5"}]});

            const result = await repo.getTotalCompletedShowsByUserId("user-1");

            expect(result).toBe(5);
        });
    });

    describe("getNotedShowsCountByUserId", () => {
        it("returns the parsed count", async () => {
            db.query.mockResolvedValue({rows: [{total: "3"}]});

            const result = await repo.getNotedShowsCountByUserId("user-1");

            expect(result).toBe(3);
        });
    });

    describe("getFavoritesCountByUserId", () => {
        it("returns the parsed count", async () => {
            db.query.mockResolvedValue({rows: [{total: "4"}]});

            const result = await repo.getFavoritesCountByUserId("user-1");

            expect(result).toBe(4);
        });

        it("returns 0 when there is no data", async () => {
            db.query.mockResolvedValue({rows: [{total: undefined}]});

            const result = await repo.getFavoritesCountByUserId("user-1");

            expect(result).toBe(0);
        });
    });

    describe("getNbShowsAddedByUserIdByYear", () => {
        it("returns the parsed count", async () => {
            db.query.mockResolvedValue({rows: [{total: "7"}]});

            const result = await repo.getNbShowsAddedByUserIdByYear("user-1", 2024);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 2024]);
            expect(result).toBe(7);
        });
    });

    describe("updateWatchingByUserIdByShowId", () => {
        it("returns the new continue state", async () => {
            db.query.mockResolvedValue({rows: [{continue: false}]});

            const result = await repo.updateWatchingByUserIdByShowId("user-1", 10);

            expect(result).toBe(false);
        });
    });

    describe("updateFavoriteByUserIdByShowId", () => {
        it("returns the new favorite state", async () => {
            db.query.mockResolvedValue({rows: [{favorite: true}]});

            const result = await repo.updateFavoriteByUserIdByShowId("user-1", 10);

            expect(result).toBe(true);
        });
    });

    describe("updateAddedAtByUserIdByShowId", () => {
        it("returns true when a row was updated", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.updateAddedAtByUserIdByShowId("user-1", 10, "2024-01-01");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10, "2024-01-01"]);
            expect(result).toBe(true);
        });
    });

    describe("updateNoteByUserIdByShowId", () => {
        it("returns true when a row was updated", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.updateNoteByUserIdByShowId("user-1", 10, 3);

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10, 3]);
            expect(result).toBe(true);
        });
    });

    describe("getShowsToResumeByUserId", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsToResumeByUserId("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getShowsToResumeByUserIdEpisodes", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsToResumeByUserIdEpisodes("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getShowsFinishedByUserId", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsFinishedByUserId("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getShowsFinishedByUserIdEpisodes", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsFinishedByUserIdEpisodes("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getKindsByUserId", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "Drame", value: "5"}]});

            const result = await repo.getKindsByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10]);
            expect(result).toEqual([{id: 0, label: "Drame", value: 5}]);
        });
    });

    describe("getKindsCountByUserId", () => {
        it("returns the parsed count", async () => {
            db.query.mockResolvedValue({rows: [{total: "6"}]});

            const result = await repo.getKindsCountByUserId("user-1");

            expect(result).toBe(6);
        });
    });

    describe("getCountriesByUserId", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{label: "FR", value: "10"}]});

            const result = await repo.getCountriesByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10]);
            expect(result).toEqual([{id: 0, label: "FR", value: 10}]);
        });
    });

    describe("getCountriesCountByUserId", () => {
        it("returns the parsed count", async () => {
            db.query.mockResolvedValue({rows: [{total: "2"}]});

            const result = await repo.getCountriesCountByUserId("user-1");

            expect(result).toBe(2);
        });
    });

    describe("getFavoritesByUserId", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getFavoritesByUserId("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getShowsWithNextEpisode", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsWithNextEpisode("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getShowsToContinueByUserId", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsToContinueByUserId("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getShowsToContinueByUserIdEpisodes", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getShowsToContinueByUserIdEpisodes("user-1");

            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getSharedShowsWithFriend", () => {
        it("maps rows to UserShow instances", async () => {
            db.query.mockResolvedValue({rows: [showRow]});

            const result = await repo.getSharedShowsWithFriend("user-1", "user-2");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", "user-2"]);
            expect(result).toEqual([expect.objectContaining({id: 10})]);
        });
    });

    describe("getRecommendationsByUserId", () => {
        it("maps rows to Recommendation instances", async () => {
            db.query.mockResolvedValue({rows: [{id: 10, title: "Show", poster: "poster.png", kind_names: ["Drame"], duration: 42, seasons: 1, country: "FR", nb_friends: "2", avg_note: "4.5", friends: [{id: "user-2", username: "bob", picture: null}]}]});

            const result = await repo.getRecommendationsByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10]);
            expect(result).toEqual([{id: 10, title: "Show", poster: "poster.png", kinds: ["Drame"], duration: 42, seasons: 1, country: "FR", nbFriends: 2, avgNote: 4.5, friends: [{id: "user-2", username: "bob", picture: null}]}]);
        });
    });

    describe("getNotesByUserId", () => {
        it("maps rows to Stat instances", async () => {
            db.query.mockResolvedValue({rows: [{id: 1, label: "Excellent", value: "8"}]});

            const result = await repo.getNotesByUserId("user-1");

            expect(result).toEqual([{id: 1, label: "Excellent", value: 8}]);
        });
    });
});
