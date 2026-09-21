import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import SeasonService from "../../../services/seasonService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

describe("SeasonService (real Postgres)", () => {
    /** @type {SeasonService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new SeasonService();
    });

    describe("deleteBySeasonId", () => {
        it("deletes the user's watched season", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await service.deleteBySeasonId(userId, userSeasonId);

            const res = await db.query(`SELECT * FROM users_seasons WHERE id = $1`, [userSeasonId]);
            expect(res.rowCount).toBe(0);
        });

        it("rejects without a season id", async () => {
            const userId = await insertUser();

            await expect(service.deleteBySeasonId(userId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("getSeasons", () => {
        it("returns seasons added in a given year", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, { addedAt: "2025-06-01" });

            const result = await service.getSeasons(userId, 2025);

            expect(result).toHaveLength(1);
        });

        it("rejects when no year is given", async () => {
            const userId = await insertUser();

            await expect(service.getSeasons(userId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateBySeasonId", () => {
        it("updates the platform and viewing date, and syncs episode platforms", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await service.updateBySeasonId(userId, userSeasonId, 1, "2025-01-01");

            const res = await db.query(`SELECT platform_id FROM users_seasons WHERE id = $1`, [userSeasonId]);
            expect(res.rows[0]["platform_id"]).toBe(1);
        });

        it("rejects missing fields", async () => {
            const userId = await insertUser();

            await expect(service.updateBySeasonId(userId, 1, undefined, "2025-01-01")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateWatchedWith", () => {
        it("tags friends who watched the season together", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            const res = await db.query(`SELECT friend_user_id FROM users_seasons_friends WHERE users_season_id = $1`, [userSeasonId]);
            expect(res.rows.map((r) => r["friend_user_id"])).toEqual([friendId]);
        });

        it("rejects tagging someone who isn't a friend", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await expect(service.updateWatchedWith(userId, userSeasonId, [strangerId])).rejects.toMatchObject({ status: 400 });
        });

        it("rejects tagging more than the max allowed friends", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const tooMany = Array.from({ length: 11 }, (_, i) => `friend-${i}`);

            await expect(service.updateWatchedWith(userId, userSeasonId, tooMany)).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a season the user doesn't own", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(otherUserId, showId);
            const userSeasonId = await insertUserSeason(otherUserId, showId, 1);

            await expect(service.updateWatchedWith(userId, userSeasonId, [])).rejects.toMatchObject({ status: 404 });
        });
    });
});
