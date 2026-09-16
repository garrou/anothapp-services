import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import UserSeasonRepository from "../../../repositories/userSeasonRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

describe("UserSeasonRepository (real Postgres)", () => {
    /** @type {UserSeasonRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserSeasonRepository();
    });

    describe("create", () => {
        it("restores an explicit addedAt, e.g. to preserve an imported viewing's date", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);

            const id = await repo.create(userId, showId, 1, 999, "2024-01-01");

            const result = await repo.getUserSeasonsByUserId(userId);
            expect(result).toEqual([expect.objectContaining({ id, addedAt: expect.any(Date) })]);
            expect(result[0].addedAt.toISOString()).toContain("2024-01-01");
        });
    });

    describe("findImportedViewing", () => {
        it("finds an already-imported viewing by its exact added date", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const id = await insertUserSeason(userId, showId, 1, { addedAt: "2024-01-01T00:00:00.000Z" });

            const result = await repo.findImportedViewing(userId, showId, 1, "2024-01-01T00:00:00.000Z");

            expect(result).toBe(id);
        });

        it("returns null when no viewing matches that date yet", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);

            const result = await repo.findImportedViewing(userId, showId, 1, "2024-01-01T00:00:00.000Z");

            expect(result).toBeNull();
        });

        it("matches a viewing whose added_at is NULL against a null addedAt, instead of never matching", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const res = await db.query(`
                INSERT INTO users_seasons (user_id, show_id, number, platform_id, added_at)
                VALUES ($1, $2, 1, 999, NULL) RETURNING id
            `, [userId, showId]);

            const result = await repo.findImportedViewing(userId, showId, 1, null);

            expect(result).toBe(res.rows[0].id);
        });
    });

    describe("getUserSeasonsByUserId", () => {
        it("includes the season's catalog image and episode count alongside the viewing", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1, { episodes: 8, image: "s1.jpg" });
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            const result = await repo.getUserSeasonsByUserId(userId);

            expect(result).toEqual([{
                id: userSeasonId, number: 1, addedAt: expect.any(Date), platform: "Autres", platformId: 999,
                showId, image: "s1.jpg", episodesCount: 8,
            }]);
        });

        it("returns every viewing including rewatches, each carrying its own season metadata", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1, { episodes: 5 });
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1);
            await insertUserSeason(userId, showId, 1);

            const result = await repo.getUserSeasonsByUserId(userId);

            expect(result).toHaveLength(2);
            expect(result.every((s) => s.episodesCount === 5)).toBe(true);
        });
    });

    describe("getMostRewatchedByUserId", () => {
        it("returns the show/season watched the most times", async () => {
            const userId = await insertUser();
            const rewatchedShow = await insertShow({ title: "Friends" });
            await insertSeason(rewatchedShow, 1);
            await insertUserShow(userId, rewatchedShow);
            await insertUserSeason(userId, rewatchedShow, 1);
            await insertUserSeason(userId, rewatchedShow, 1);
            await insertUserSeason(userId, rewatchedShow, 1);

            const onceShow = await insertShow({ title: "Chernobyl" });
            await insertSeason(onceShow, 1);
            await insertUserShow(userId, onceShow);
            await insertUserSeason(userId, onceShow, 1);

            const result = await repo.getMostRewatchedByUserId(userId);

            expect(result).toEqual({ showTitle: "Friends", seasonNumber: 1, timesWatched: 3 });
        });

        it("returns null when no season was ever watched more than once", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1);

            const result = await repo.getMostRewatchedByUserId(userId);

            expect(result).toBeNull();
        });

        it("returns null for a user with no viewing history at all", async () => {
            const userId = await insertUser();

            const result = await repo.getMostRewatchedByUserId(userId);

            expect(result).toBeNull();
        });

        it("only considers the requesting user's own viewings", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(otherUserId, showId);
            await insertUserSeason(otherUserId, showId, 1);
            await insertUserSeason(otherUserId, showId, 1);

            const result = await repo.getMostRewatchedByUserId(userId);

            expect(result).toBeNull();
        });
    });

    describe("getMaxRewatchCountByUserId", () => {
        it("returns the highest per-season viewing count", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1);
            await insertUserSeason(userId, showId, 1);
            await insertUserSeason(userId, showId, 1);
            await insertUserSeason(userId, showId, 1);

            const result = await repo.getMaxRewatchCountByUserId(userId);

            expect(result).toBe(4);
        });

        it("returns 0 when the user has no watched seasons at all", async () => {
            const userId = await insertUser();

            const result = await repo.getMaxRewatchCountByUserId(userId);

            expect(result).toBe(0);
        });
    });

    describe("getTotalTimeByUserId", () => {
        it("sums duration * episodes across every watched season", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1, { episodes: 10 });
            await insertSeason(showId, 2, { episodes: 8 });
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1);
            await insertUserSeason(userId, showId, 2);

            const result = await repo.getTotalTimeByUserId(userId);

            expect(result).toBe(30 * 10 + 30 * 8);
        });

        it("returns 0 for a user who hasn't watched anything", async () => {
            const userId = await insertUser();

            const result = await repo.getTotalTimeByUserId(userId);

            expect(result).toBe(0);
        });
    });

    describe("getRecordViewingTimeDay", () => {
        it("excludes a season whose own runtime alone exceeds a calendar day", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 200 });
            await insertSeason(showId, 1, { episodes: 10 }); // 2000 min > 1440
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, { addedAt: "2026-01-05" });

            const result = await repo.getRecordViewingTimeDay(userId, 5);

            expect(result).toEqual([]);
        });

        it("excludes a day whose total, summed across several seasons, exceeds a calendar day", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 60 });
            await insertSeason(showId, 1, { episodes: 10 }); // 600 min
            await insertSeason(showId, 2, { episodes: 15 }); // 900 min - together: 1500 > 1440
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, { addedAt: "2026-01-05" });
            await insertUserSeason(userId, showId, 2, { addedAt: "2026-01-05" });

            const result = await repo.getRecordViewingTimeDay(userId, 5);

            expect(result).toEqual([]);
        });

        it("reports the day's total when it stays within a calendar day", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ duration: 60 });
            await insertSeason(showId, 1, { episodes: 5 }); // 300 min
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, { addedAt: "2026-01-05" });

            const result = await repo.getRecordViewingTimeDay(userId, 5);

            expect(result).toEqual([{ id: 0, label: "05/01/2026", value: 300 }]);
        });
    });
});
