import { describe, it, expect, beforeEach } from "vitest";
import db from "../config/db.js";
import UserEpisodeStatRepository from "./userEpisodeStatRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import {
    insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode,
} from "../tests/pg/fixtures.js";

describe("UserEpisodeStatRepository (real Postgres)", () => {
    /** @type {UserEpisodeStatRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserEpisodeStatRepository();
    });

    /** Watches a single episode for the user, on a given date, with a given runtime. */
    const watchEpisode = async (userId, showId, seasonNumber, { length = 30, watchedAt = null } = {}) => {
        const userSeasonId = await insertUserSeason(userId, showId, seasonNumber, { addedAt: watchedAt });
        const episodeId = await insertEpisode(showId, seasonNumber, { length });
        return insertUserEpisode(userId, userSeasonId, episodeId, { watchedAt });
    };

    describe("getTotalTimeByUserId", () => {
        it("sums episode length, falling back to show duration when null", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 45 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 20 });
            await watchEpisode(userId, showId, 1, { length: null });

            const result = await repo.getTotalTimeByUserId(userId);

            expect(result).toBe(20 + 45);
        });

        it("returns 0 for a user with no watched episodes", async () => {
            const userId = await insertUser();

            expect(await repo.getTotalTimeByUserId(userId)).toBe(0);
        });
    });

    describe("getTimeCurrentMonthByUserId / getTimeCurrentMonthByUserIds", () => {
        it("only counts days within the current month", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 30 });

            const result = await repo.getTimeCurrentMonthByUserId(userId);

            expect(result).toBe(30);
        });

        it("getTimeCurrentMonthByUserIds returns a map keyed by user id", async () => {
            const userA = await insertUser();
            const userB = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userA, showId);
            await watchEpisode(userA, showId, 1, { length: 30 });

            const result = await repo.getTimeCurrentMonthByUserIds([userA, userB]);

            expect(result.get(userA)).toBe(30);
            expect(result.has(userB)).toBe(false);
        });

        it("getTimeCurrentMonthByUserIds returns an empty map for an empty list", async () => {
            expect((await repo.getTimeCurrentMonthByUserIds([])).size).toBe(0);
        });
    });

    describe("getTimeHourByUserIdGroupByYear", () => {
        it("groups watch time in hours by year", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 60 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 120, watchedAt: "2025-06-01" });

            const result = await repo.getTimeHourByUserIdGroupByYear(userId);

            expect(result).toContainEqual({ id: 0, label: "2025", value: 2 });
        });
    });

    describe("getRecordViewingTimeMonth", () => {
        it("reports the total for the month with the highest watch time", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 60, watchedAt: "2025-03-05" });

            const result = await repo.getRecordViewingTimeMonth(userId);

            expect(result).toEqual([{ id: 0, label: "03/2025", value: 60 }]);
        });

        it("excludes a month whose total exceeds the plausibility cap", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 50000 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: null, watchedAt: "2025-03-05" });

            const result = await repo.getRecordViewingTimeMonth(userId);

            expect(result).toEqual([]);
        });
    });

    describe("getRecordViewingTimeDay", () => {
        it("reports the day with the highest watch time", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 60, watchedAt: "2025-03-05" });

            const result = await repo.getRecordViewingTimeDay(userId);

            expect(result).toEqual([{ id: 0, label: "05/03/2025", value: 60 }]);
        });

        it("excludes a day whose total exceeds a calendar day", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 2000 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: null, watchedAt: "2025-03-05" });

            const result = await repo.getRecordViewingTimeDay(userId);

            expect(result).toEqual([]);
        });
    });

    describe("getRankingViewingTimeByShows", () => {
        it("ranks shows by watch time in hours, descending", async () => {
            const userId = await insertUser();
            const bigShow = await insertShow({ duration: 120, title: "Big" });
            const smallShow = await insertShow({ duration: 30, title: "Small" });
            await insertSeason(bigShow, 1);
            await insertSeason(smallShow, 1);
            await insertUserShow(userId, bigShow);
            await insertUserShow(userId, smallShow);
            await watchEpisode(userId, bigShow, 1, { length: 120 });
            await watchEpisode(userId, smallShow, 1, { length: 30 });

            const result = await repo.getRankingViewingTimeByShows(userId);

            expect(result.map((s) => s.label)).toEqual(["Big", "Small"]);
        });
    });

    describe("getTotalEpisodesByUserId", () => {
        it("counts watched episodes", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1);
            await watchEpisode(userId, showId, 1);

            expect(await repo.getTotalEpisodesByUserId(userId)).toBe(2);
        });
    });

    describe("getNbEpisodesByUserIdGroupByYear", () => {
        it("groups episode counts by year", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { watchedAt: "2025-01-01" });

            const result = await repo.getNbEpisodesByUserIdGroupByYear(userId);

            expect(result).toContainEqual({ id: 0, label: "2025", value: 1 });
        });
    });

    describe("getNbEpisodesByUserIdGroupByMonthByCurrentYear", () => {
        it("groups this year's episode counts by French month name", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const now = new Date();
            await watchEpisode(userId, showId, 1, { watchedAt: now.toISOString() });

            const result = await repo.getNbEpisodesByUserIdGroupByMonthByCurrentYear(userId);

            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(1);
        });
    });

    describe("getTotalTimeByUserIdByYear / getTotalEpisodesByUserIdByYear", () => {
        it("only counts the given year", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 30, watchedAt: "2025-01-01" });
            await watchEpisode(userId, showId, 1, { length: 30, watchedAt: "2026-01-01" });

            expect(await repo.getTotalTimeByUserIdByYear(userId, 2025)).toBe(30);
            expect(await repo.getTotalEpisodesByUserIdByYear(userId, 2025)).toBe(1);
        });
    });

    describe("getTopShowByUserIdByYear", () => {
        it("returns the show watched the most that year", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 60, title: "Top Show" });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 60, watchedAt: "2025-01-01" });

            const result = await repo.getTopShowByUserIdByYear(userId, 2025);

            expect(result).toEqual({ id: 0, label: "Top Show", value: 60 });
        });

        it("returns null when nothing was watched that year", async () => {
            const userId = await insertUser();

            expect(await repo.getTopShowByUserIdByYear(userId, 2025)).toBeNull();
        });
    });

    describe("getKindsTimeByUserIdByYear", () => {
        it("returns the kind with the most watch time that year", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 60 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await db.query(`INSERT INTO shows_kinds (show_id, kind_id) VALUES ($1, 'Drama')`, [showId]);
            await watchEpisode(userId, showId, 1, { length: 60, watchedAt: "2025-01-01" });

            const result = await repo.getKindsTimeByUserIdByYear(userId, 2025);

            expect(result).toEqual({ id: 0, label: "Drame", value: 60 });
        });
    });

    describe("getTopPlatformByUserIdByYear", () => {
        it("returns the platform used the most that year", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1, { addedAt: "2025-01-01" });
            const episodeId = await insertEpisode(showId, 1, { length: 30 });
            await insertUserEpisode(userId, userSeasonId, episodeId, { platformId: 1, watchedAt: "2025-01-01" });

            const result = await repo.getTopPlatformByUserIdByYear(userId, 2025);

            expect(result).toEqual({ id: 0, label: "Netflix", value: 1 });
        });
    });

    describe("getBestMonthByUserIdByYear", () => {
        it("returns the month with the most watch time that year", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 90 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { length: 90, watchedAt: "2025-07-01" });

            const result = await repo.getBestMonthByUserIdByYear(userId, 2025);

            expect(result).toMatchObject({ value: 90 });
        });
    });

    describe("getWatchedDatesByUserId / getWatchedDatesByUserIdByYear", () => {
        it("returns distinct watched dates", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { watchedAt: "2025-01-01" });

            expect(await repo.getWatchedDatesByUserId(userId)).toEqual(["2025-01-01"]);
            expect(await repo.getWatchedDatesByUserIdByYear(userId, 2025)).toEqual(["2025-01-01"]);
            expect(await repo.getWatchedDatesByUserIdByYear(userId, 2024)).toEqual([]);
        });
    });

    describe("getWatchedByDay", () => {
        it("counts episodes watched per day", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await watchEpisode(userId, showId, 1, { watchedAt: "2025-01-01" });
            await watchEpisode(userId, showId, 1, { watchedAt: "2025-01-01" });

            const result = await repo.getWatchedByDay(userId);

            expect(result).toEqual([{ date: "2025-01-01", value: 2 }]);
        });
    });
});
