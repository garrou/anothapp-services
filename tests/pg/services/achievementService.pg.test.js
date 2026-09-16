import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import AchievementService from "../../../services/achievementService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

describe("AchievementService (real Postgres)", () => {
    /** @type {AchievementService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new AchievementService();
    });

    describe("evaluate", () => {
        it("unlocks the first streak tier and records a notification", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, { addedAt: new Date().toISOString() });

            await service.evaluate(userId, ["streak"]);

            const res = await db.query(`SELECT * FROM users_achievements WHERE user_id = $1 AND code = 'streak'`, [userId]);
            expect(res.rowCount).toBe(1);
            expect(res.rows[0].league).toBe(1);
            expect(res.rows[0]["sub_tier"]).toBe(3);
            const notifications = await db.query(`SELECT * FROM notifications WHERE recipient_user_id = $1 AND type = 'achievement_unlocked'`, [userId]);
            expect(notifications.rowCount).toBe(1);
        });

        it("does not downgrade or duplicate-notify when re-evaluated at the same level", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, { addedAt: new Date().toISOString() });
            await service.evaluate(userId, ["streak"]);

            await service.evaluate(userId, ["streak"]);

            const notifications = await db.query(`SELECT * FROM notifications WHERE recipient_user_id = $1 AND type = 'achievement_unlocked'`, [userId]);
            expect(notifications.rowCount).toBe(1);
        });

        it("does nothing for a user with no activity at all", async () => {
            const userId = await insertUser();

            await service.evaluate(userId, ["streak", "shows_started"]);

            const res = await db.query(`SELECT * FROM users_achievements WHERE user_id = $1`, [userId]);
            expect(res.rowCount).toBe(0);
        });

        it("unlocks shows_started from a real collection count", async () => {
            const userId = await insertUser();
            await insertUserShow(userId, await insertShow());
            await insertUserShow(userId, await insertShow());
            await insertUserShow(userId, await insertShow());

            await service.evaluate(userId, ["shows_started"]);

            const res = await db.query(`SELECT league, sub_tier FROM users_achievements WHERE user_id = $1 AND code = 'shows_started'`, [userId]);
            expect(res.rows[0]).toEqual({ league: 1, sub_tier: 3 });
        });
    });

    describe("getAchievements", () => {
        it("returns full progress details for the current user, including locked achievements", async () => {
            const userId = await insertUser();

            const result = await service.getAchievements(userId);

            expect(result.length).toBeGreaterThan(0);
            const streak = result.find((a) => a.code === "streak");
            expect(streak.league).toBeNull();
            expect(streak.progress).toBe(0);
        });

        it("only shows unlocked achievements when viewing a friend, with no raw value leaked", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            await insertUserShow(friendId, await insertShow());
            await insertUserShow(friendId, await insertShow());
            await insertUserShow(friendId, await insertShow());
            await service.evaluate(friendId, ["shows_started"]);

            const result = await service.getAchievements(userId, friendId);

            expect(result.every((a) => a.league !== null)).toBe(true);
            expect(result.some((a) => a.code === "shows_started")).toBe(true);
        });

        it("rejects viewing a non-friend's achievements", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();

            await expect(service.getAchievements(userId, strangerId)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("getTierCatalog", () => {
        it("returns every code's tiers sorted ascending by threshold", async () => {
            const catalog = await service.getTierCatalog();

            expect(catalog.streak[0].threshold).toBeLessThan(catalog.streak.at(-1).threshold);
        });
    });
});
