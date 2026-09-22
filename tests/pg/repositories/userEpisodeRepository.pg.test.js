import { describe, it, expect, beforeEach } from "vitest";
import UserEpisodeRepository from "../../../repositories/userEpisodeRepository.js";
import { resetDb } from "../resetDb.js";
import {
    insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode,
} from "../fixtures.js";

describe("UserEpisodeRepository (real Postgres)", () => {
    /** @type {UserEpisodeRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserEpisodeRepository();
    });

    describe("getViewedByMonthAgo", () => {
        it("returns episodes watched within the given number of months back", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Recent" });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { title: "Pilot" });
            await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await repo.getViewedByMonthAgo(userId, 1);

            expect(result).toHaveLength(1);
            expect(result[0].showTitle).toBe("Recent");
            expect(result[0].episode.title).toBe("Pilot");
        });

        it("excludes episodes watched before the cutoff", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await insertUserEpisode(userId, userSeasonId, episodeId, { watchedAt: "2020-01-01" });

            const result = await repo.getViewedByMonthAgo(userId, 1);

            expect(result).toEqual([]);
        });
    });

    describe("getWatchedTimeByShowIdBySeasonNumber", () => {
        it("sums the watch time of a specific season", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 40 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { length: 25 });
            await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await repo.getWatchedTimeByShowIdBySeasonNumber(userId, showId, 1);

            expect(result).toBe(25);
        });

        it("returns 0 when nothing was watched", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            const result = await repo.getWatchedTimeByShowIdBySeasonNumber(userId, showId, 1);

            expect(result).toBe(0);
        });
    });

    describe("getWatchedTimeAndCountByShowId", () => {
        it("returns time, episode count, and distinct episode count across rewatched seasons", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const episodeId = await insertEpisode(showId, 1, { length: 20 });
            const firstWatch = await insertUserSeason(userId, showId, 1);
            await insertUserEpisode(userId, firstWatch, episodeId);
            const rewatch = await insertUserSeason(userId, showId, 1);
            await insertUserEpisode(userId, rewatch, episodeId);

            const [time, episodes, distinctEpisodes] = await repo.getWatchedTimeAndCountByShowId(userId, showId);

            expect(time).toBe(40);
            expect(episodes).toBe(2);
            expect(distinctEpisodes).toBe(1);
        });
    });

    describe("create / existsForViewing", () => {
        it("creates a viewing record", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);

            const result = await repo.create(userId, userSeasonId, episodeId, new Date().toISOString(), 999);

            expect(result).toBe(true);
            expect(await repo.existsForViewing(userSeasonId, episodeId)).toBe(true);
        });

        it("returns false instead of throwing a unique-constraint error when the row already exists", async () => {
            // simulates the watch-together race: a mirrored write lands on this exact
            // (users_seasons_id, episode_id) row before this call - real Postgres, real UNIQUE
            // constraint, must resolve via ON CONFLICT DO NOTHING rather than propagate an error
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await repo.create(userId, userSeasonId, episodeId, new Date().toISOString(), 999);

            const result = await repo.create(userId, userSeasonId, episodeId, new Date().toISOString(), 999);

            expect(result).toBe(false);
        });
    });

    describe("createIfMissing", () => {
        it("creates the viewing when it does not exist yet", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);

            const result = await repo.createIfMissing(userId, userSeasonId, episodeId, new Date().toISOString(), 999);

            expect(result).toBe(true);
        });

        it("does nothing when a viewing already exists for that episode/season", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await repo.createIfMissing(userId, userSeasonId, episodeId, new Date().toISOString(), 999);

            expect(result).toBe(false);
        });
    });

    describe("updateWatchedAt", () => {
        it("updates the watched date of the user's own viewing", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            const viewingId = await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await repo.updateWatchedAt(userId, viewingId, "2025-01-01");

            expect(result).toBe(true);
        });

        it("does not update another user's viewing", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            const viewingId = await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await repo.updateWatchedAt(otherUserId, viewingId, "2025-01-01");

            expect(result).toBe(false);
        });
    });

    describe("updatePlatformByUserSeasonId", () => {
        it("updates the platform of every viewing in the season", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await insertUserEpisode(userId, userSeasonId, episodeId, { platformId: 999 });

            await repo.updatePlatformByUserSeasonId(userSeasonId, 1);

            const episodes = await repo.getByUserSeasonId(userSeasonId, showId, 1);
            expect(episodes[0].id).not.toBeNull();
        });
    });

    describe("deleteById", () => {
        it("deletes the user's own viewing", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            const viewingId = await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await repo.deleteById(userId, viewingId);

            expect(result).toBe(true);
            expect(await repo.existsForViewing(userSeasonId, episodeId)).toBe(false);
        });

        it("returns false for another user's viewing", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            const viewingId = await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await repo.deleteById(otherUserId, viewingId);

            expect(result).toBe(false);
        });
    });

    describe("getAllByUserId", () => {
        it("returns every viewing grouped by season, ordered by episode number", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const ep1 = await insertEpisode(showId, 1, { number: 1 });
            const ep2 = await insertEpisode(showId, 1, { number: 2 });
            await insertUserEpisode(userId, userSeasonId, ep2);
            await insertUserEpisode(userId, userSeasonId, ep1);

            const result = await repo.getAllByUserId(userId);

            expect(result.map((r) => r.episode.number)).toEqual([1, 2]);
            expect(result.every((r) => r.userSeasonId === userSeasonId)).toBe(true);
        });

        it("includes the episode's length and description, needed to recreate it on a re-import", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { length: 52, description: "desc" });
            await insertUserEpisode(userId, userSeasonId, episodeId);

            const [result] = await repo.getAllByUserId(userId);

            expect(result.episode.length).toBe(52);
            expect(result.episode.description).toBe("desc");
        });
    });

    describe("getByUserSeasonId", () => {
        it("returns every episode of the season, watched or not, in number order", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertEpisode(showId, 1, { number: 1, id: 1 });
            const watchedEpisodeId = await insertEpisode(showId, 1, { number: 2, id: 2 });
            await insertUserEpisode(userId, userSeasonId, watchedEpisodeId);

            const result = await repo.getByUserSeasonId(userSeasonId, showId, 1);

            expect(result).toHaveLength(2);
            expect(result[0].watchedAt).toBeNull();
            expect(result[1].watchedAt).not.toBeNull();
        });
    });
});
