import { describe, it, expect, beforeEach } from "vitest";
import db from "../config/db.js";
import UserShowRepository from "./userShowRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import {
    insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode,
} from "../tests/pg/fixtures.js";

describe("UserShowRepository (real Postgres)", () => {
    /** @type {UserShowRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserShowRepository();
    });

    describe("create / checkShowExistsByUserIdByShowId", () => {
        it("adds a show to the user's collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            const result = await repo.create(userId, showId);

            expect(result).toBe(true);
            expect(await repo.checkShowExistsByUserIdByShowId(userId, showId)).toBe(true);
        });

        it("checkShowExistsByUserIdByShowId returns false when absent", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            expect(await repo.checkShowExistsByUserIdByShowId(userId, showId)).toBe(false);
        });
    });

    describe("deleteByUserIdShowId", () => {
        it("removes the show from the user's collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await repo.create(userId, showId);

            const result = await repo.deleteByUserIdShowId(userId, showId);

            expect(result).toBe(true);
            expect(await repo.checkShowExistsByUserIdByShowId(userId, showId)).toBe(false);
        });
    });

    describe("getShowsByUserId", () => {
        it("returns the user's shows, newest added first", async () => {
            const userId = await insertUser();
            const older = await insertShow({ title: "Older" });
            await insertUserShow(userId, older);
            await new Promise((resolve) => setTimeout(resolve, 10));
            const newer = await insertShow({ title: "Newer" });
            await insertUserShow(userId, newer);

            const result = await repo.getShowsByUserId(userId, null, [], [], [], []);

            expect(result.map((s) => s.title)).toEqual(["Newer", "Older"]);
        });

        it("filters by title", async () => {
            const userId = await insertUser();
            const match = await insertShow({ title: "Breaking Bad" });
            const noMatch = await insertShow({ title: "Dark" });
            await insertUserShow(userId, match);
            await insertUserShow(userId, noMatch);

            const result = await repo.getShowsByUserId(userId, "breaking", [], [], [], []);

            expect(result.map((s) => s.title)).toEqual(["Breaking Bad"]);
        });

        it("filters by country", async () => {
            const userId = await insertUser();
            const us = await insertShow({ title: "US Show", country: "US" });
            const fr = await insertShow({ title: "FR Show", country: "FR" });
            await insertUserShow(userId, us);
            await insertUserShow(userId, fr);

            const result = await repo.getShowsByUserId(userId, null, [], ["FR"], [], []);

            expect(result.map((s) => s.title)).toEqual(["FR Show"]);
        });

        it("filters by kind", async () => {
            const userId = await insertUser();
            const drama = await insertShow({ title: "Drama Show" });
            const comedy = await insertShow({ title: "Comedy Show" });
            await db.query(`INSERT INTO shows_kinds (show_id, kind_id) VALUES ($1, 'Drama')`, [drama]);
            await db.query(`INSERT INTO shows_kinds (show_id, kind_id) VALUES ($1, 'Comedy')`, [comedy]);
            await insertUserShow(userId, drama);
            await insertUserShow(userId, comedy);

            const result = await repo.getShowsByUserId(userId, null, [], [], ["Drama"], []);

            expect(result.map((s) => s.title)).toEqual(["Drama Show"]);
        });

        it("filters by note", async () => {
            const userId = await insertUser();
            const noted = await insertShow({ title: "Noted" });
            const unnoted = await insertShow({ title: "Unnoted" });
            await insertUserShow(userId, noted, { noteId: 5 });
            await insertUserShow(userId, unnoted);

            const result = await repo.getShowsByUserId(userId, null, [], [], [], [5]);

            expect(result.map((s) => s.title)).toEqual(["Noted"]);
        });

        it("filters by platform used", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, {});

            const noPlatform = await repo.getShowsByUserId(userId, null, [999999], [], [], []);
            const rightPlatform = await repo.getShowsByUserId(userId, null, [999], [], [], []);

            expect(noPlatform).toEqual([]);
            expect(rightPlatform).toHaveLength(1);
        });

        it("filters by friend watched with", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await db.query(`
                INSERT INTO users_seasons_friends (users_season_id, friend_user_id) VALUES ($1, $2)
            `, [userSeasonId, friendId]);

            const result = await repo.getShowsByUserId(userId, null, [], [], [], [], [friendId]);

            expect(result).toHaveLength(1);
        });
    });

    describe("getShowByUserIdByShowId", () => {
        it("returns the show", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Specific" });
            await insertUserShow(userId, showId);

            const result = await repo.getShowByUserIdByShowId(userId, showId);

            expect(result.title).toBe("Specific");
        });

        it("returns null when not in the user's collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            expect(await repo.getShowByUserIdByShowId(userId, showId)).toBeNull();
        });
    });

    describe("getTotalShowsByUserId", () => {
        it("counts the user's shows", async () => {
            const userId = await insertUser();
            await insertUserShow(userId, await insertShow());
            await insertUserShow(userId, await insertShow());

            expect(await repo.getTotalShowsByUserId(userId)).toBe(2);
        });
    });

    describe("getTotalCompletedShowsByUserId", () => {
        it("counts shows where every season has been watched", async () => {
            const userId = await insertUser();
            const completeShow = await insertShow({ seasons: 1 });
            await insertSeason(completeShow, 1);
            await insertUserShow(userId, completeShow);
            await insertUserSeason(userId, completeShow, 1);

            const incompleteShow = await insertShow({ seasons: 2 });
            await insertSeason(incompleteShow, 1);
            await insertSeason(incompleteShow, 2);
            await insertUserShow(userId, incompleteShow);
            await insertUserSeason(userId, incompleteShow, 1);

            expect(await repo.getTotalCompletedShowsByUserId(userId)).toBe(1);
        });
    });

    describe("getNotedShowsCountByUserId / getFavoritesCountByUserId", () => {
        it("counts noted and favorited shows separately", async () => {
            const userId = await insertUser();
            await insertUserShow(userId, await insertShow(), { noteId: 3 });
            await insertUserShow(userId, await insertShow(), { favorite: true });
            await insertUserShow(userId, await insertShow());

            expect(await repo.getNotedShowsCountByUserId(userId)).toBe(1);
            expect(await repo.getFavoritesCountByUserId(userId)).toBe(1);
        });
    });

    describe("getNbShowsAddedByUserIdByYear", () => {
        it("only counts shows added in the given year", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await db.query(`
                INSERT INTO users_shows (user_id, show_id, added_at) VALUES ($1, $2, '2025-06-01')
            `, [userId, showId]);

            expect(await repo.getNbShowsAddedByUserIdByYear(userId, 2025)).toBe(1);
            expect(await repo.getNbShowsAddedByUserIdByYear(userId, 2024)).toBe(0);
        });
    });

    describe("updateWatchingByUserIdByShowId / updateFavoriteByUserIdByShowId", () => {
        it("toggles the continue-watching flag", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId, { continueWatching: true });

            const result = await repo.updateWatchingByUserIdByShowId(userId, showId);

            expect(result).toBe(false);
        });

        it("toggles the favorite flag", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId, { favorite: false });

            const result = await repo.updateFavoriteByUserIdByShowId(userId, showId);

            expect(result).toBe(true);
        });
    });

    describe("updateAddedAtByUserIdByShowId / updateNoteByUserIdByShowId", () => {
        it("updates added_at", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId);

            const result = await repo.updateAddedAtByUserIdByShowId(userId, showId, "2025-01-01");

            expect(result).toBe(true);
        });

        it("updates the note", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId);

            const result = await repo.updateNoteByUserIdByShowId(userId, showId, 4);

            expect(result).toBe(true);
            const show = await repo.getShowByUserIdByShowId(userId, showId);
            expect(show.note).toBe(4);
        });
    });

    describe("getShowsToResumeByUserId / getShowsToResumeByUserIdEpisodes", () => {
        it("returns shows marked as not-continuing with unwatched seasons", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ seasons: 2, title: "To Resume" });
            await insertSeason(showId, 1);
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId, { continueWatching: false });
            await insertUserSeason(userId, showId, 1);

            const bySeasons = await repo.getShowsToResumeByUserId(userId);
            const byEpisodes = await repo.getShowsToResumeByUserIdEpisodes(userId);

            expect(bySeasons.map((s) => s.title)).toEqual(["To Resume"]);
            expect(byEpisodes.map((s) => s.title)).toEqual(["To Resume"]);
        });

        it("excludes a fully-watched show", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ seasons: 1 });
            await insertSeason(showId, 1, { episodes: 1 });
            await insertUserShow(userId, showId, { continueWatching: false });
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await insertUserEpisode(userId, userSeasonId, episodeId);

            expect(await repo.getShowsToResumeByUserId(userId)).toEqual([]);
            expect(await repo.getShowsToResumeByUserIdEpisodes(userId)).toEqual([]);
        });
    });

    describe("getShowsFinishedByUserId / getShowsFinishedByUserIdEpisodes", () => {
        it("returns finished shows the user has fully watched", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ seasons: 1, finished: true, title: "Finished" });
            await insertSeason(showId, 1, { episodes: 1 });
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await insertUserEpisode(userId, userSeasonId, episodeId);

            const bySeasons = await repo.getShowsFinishedByUserId(userId);
            const byEpisodes = await repo.getShowsFinishedByUserIdEpisodes(userId);

            expect(bySeasons.map((s) => s.title)).toEqual(["Finished"]);
            expect(byEpisodes.map((s) => s.title)).toEqual(["Finished"]);
        });

        it("excludes an unfinished show", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ finished: false });
            await insertUserShow(userId, showId);

            expect(await repo.getShowsFinishedByUserId(userId)).toEqual([]);
        });
    });

    describe("getKindsByUserId / getKindsCountByUserId", () => {
        it("ranks and counts distinct kinds across the user's shows", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await db.query(`
                INSERT INTO shows_kinds (show_id, kind_id) VALUES ($1, 'Drama'), ($1, 'Crime')
            `, [showId]);
            await insertUserShow(userId, showId);

            const kinds = await repo.getKindsByUserId(userId);
            const count = await repo.getKindsCountByUserId(userId);

            expect(kinds.map((k) => k.label).sort()).toEqual(["Crime", "Drame"]);
            expect(count).toBe(2);
        });
    });

    describe("getCountriesByUserId / getCountriesCountByUserId", () => {
        it("ranks and counts distinct countries", async () => {
            const userId = await insertUser();
            await insertUserShow(userId, await insertShow({ country: "US" }));
            await insertUserShow(userId, await insertShow({ country: "FR" }));
            await insertUserShow(userId, await insertShow({ country: "US" }));

            const countries = await repo.getCountriesByUserId(userId);
            const count = await repo.getCountriesCountByUserId(userId);

            expect(countries[0]).toMatchObject({ label: "US", value: 2 });
            expect(count).toBe(2);
        });
    });

    describe("getFavoritesByUserId", () => {
        it("returns only favorited shows", async () => {
            const userId = await insertUser();
            await insertUserShow(userId, await insertShow({ title: "Fav" }), { favorite: true });
            await insertUserShow(userId, await insertShow({ title: "NotFav" }), { favorite: false });

            const result = await repo.getFavoritesByUserId(userId);

            expect(result.map((s) => s.title)).toEqual(["Fav"]);
        });
    });

    describe("getShowsWithNextEpisode", () => {
        it("returns continuing shows with a scheduled next episode", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Airing" });
            await db.query(`UPDATE shows SET next_episode = '2026-01-05' WHERE id = $1`, [showId]);
            await insertUserShow(userId, showId, { continueWatching: true });

            const result = await repo.getShowsWithNextEpisode(userId);

            expect(result.map((s) => s.title)).toEqual(["Airing"]);
        });

        it("excludes shows that were stopped", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await db.query(`UPDATE shows SET next_episode = '2026-01-05' WHERE id = $1`, [showId]);
            await insertUserShow(userId, showId, { continueWatching: false });

            expect(await repo.getShowsWithNextEpisode(userId)).toEqual([]);
        });
    });

    describe("getShowsToContinueByUserId / getShowsToContinueByUserIdEpisodes", () => {
        it("returns shows being continued with missing seasons", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ seasons: 2, title: "Continuing" });
            await insertSeason(showId, 1);
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId, { continueWatching: true });
            await insertUserSeason(userId, showId, 1);

            const bySeasons = await repo.getShowsToContinueByUserId(userId);
            const byEpisodes = await repo.getShowsToContinueByUserIdEpisodes(userId);

            expect(bySeasons.map((s) => s.title)).toEqual(["Continuing"]);
            expect(byEpisodes.map((s) => s.title)).toEqual(["Continuing"]);
        });
    });

    describe("getSharedShowsWithFriend", () => {
        it("returns shows both users have in their collection", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const sharedShow = await insertShow({ title: "Shared" });
            const onlyMine = await insertShow({ title: "Mine" });
            await insertUserShow(userId, sharedShow);
            await insertUserShow(friendId, sharedShow);
            await insertUserShow(userId, onlyMine);

            const result = await repo.getSharedShowsWithFriend(userId, friendId);

            expect(result.map((s) => s.title)).toEqual(["Shared"]);
        });
    });

    describe("getRecommendationsByUserId", () => {
        it("recommends a well-noted show from an accepted friend, not already in the user's collection or list", async () => {
            const userId = await insertUser();
            const friendId = await insertUser({ username: "Recommender" });
            await db.query(`
                INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)
            `, [userId, friendId]);
            const showId = await insertShow({ title: "Recommended" });
            await insertUserShow(friendId, showId, { noteId: 4 });

            const result = await repo.getRecommendationsByUserId(userId);

            expect(result.map((r) => r.title)).toEqual(["Recommended"]);
            expect(result[0].nbFriends).toBe(1);
        });

        it("excludes a show already in the user's own collection", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`
                INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)
            `, [userId, friendId]);
            const showId = await insertShow();
            await insertUserShow(friendId, showId, { noteId: 5 });
            await insertUserShow(userId, showId);

            expect(await repo.getRecommendationsByUserId(userId)).toEqual([]);
        });

        it("excludes a poorly-noted show", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`
                INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)
            `, [userId, friendId]);
            const showId = await insertShow();
            await insertUserShow(friendId, showId, { noteId: 2 });

            expect(await repo.getRecommendationsByUserId(userId)).toEqual([]);
        });
    });

    describe("getNotesByUserId", () => {
        it("counts shows per note", async () => {
            const userId = await insertUser();
            await insertUserShow(userId, await insertShow(), { noteId: 5 });
            await insertUserShow(userId, await insertShow(), { noteId: 5 });
            await insertUserShow(userId, await insertShow(), { noteId: 3 });

            const result = await repo.getNotesByUserId(userId);

            expect(result).toContainEqual({ id: 5, label: "Excellent", value: 2 });
            expect(result).toContainEqual({ id: 3, label: "Bien", value: 1 });
        });
    });
});
