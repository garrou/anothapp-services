import { describe, it, expect, beforeEach } from "vitest";
import AchievementRepository from "./achievementRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import { insertUser } from "../tests/pg/fixtures.js";

describe("AchievementRepository (real Postgres)", () => {
    /** @type {AchievementRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new AchievementRepository();
    });

    describe("getTiers", () => {
        it("returns the seeded achievement tiers", async () => {
            const result = await repo.getTiers();

            expect(result.length).toBeGreaterThan(0);
            expect(result).toContainEqual({ code: "streak", league: 1, subTier: 3, threshold: 1 });
        });
    });

    describe("getUserAchievements", () => {
        it("returns a map of the user's unlocked achievements", async () => {
            const userId = await insertUser();
            await repo.upsertUserAchievement(userId, "streak", 2, 2);

            const result = await repo.getUserAchievements(userId);

            expect(result.get("streak")).toMatchObject({ code: "streak", league: 2, subTier: 2 });
        });

        it("returns an empty map for a user with no achievements", async () => {
            const userId = await insertUser();

            const result = await repo.getUserAchievements(userId);

            expect(result.size).toBe(0);
        });
    });

    describe("upsertUserAchievement", () => {
        it("unlocks a new achievement", async () => {
            const userId = await insertUser();

            const result = await repo.upsertUserAchievement(userId, "streak", 1, 3);

            expect(result).toBe(true);
            const achievements = await repo.getUserAchievements(userId);
            expect(achievements.get("streak")).toMatchObject({ league: 1, subTier: 3 });
        });

        it("raises the tier when the new league is higher", async () => {
            const userId = await insertUser();
            await repo.upsertUserAchievement(userId, "streak", 1, 3);

            const result = await repo.upsertUserAchievement(userId, "streak", 2, 3);

            expect(result).toBe(true);
            const achievements = await repo.getUserAchievements(userId);
            expect(achievements.get("streak")).toMatchObject({ league: 2, subTier: 3 });
        });

        it("raises the sub-tier within the same league", async () => {
            const userId = await insertUser();
            await repo.upsertUserAchievement(userId, "streak", 2, 3);

            const result = await repo.upsertUserAchievement(userId, "streak", 2, 1);

            expect(result).toBe(true);
            const achievements = await repo.getUserAchievements(userId);
            expect(achievements.get("streak")).toMatchObject({ league: 2, subTier: 1 });
        });

        it("does not downgrade an already higher tier", async () => {
            const userId = await insertUser();
            await repo.upsertUserAchievement(userId, "streak", 3, 1);

            const result = await repo.upsertUserAchievement(userId, "streak", 1, 3);

            expect(result).toBe(false);
            const achievements = await repo.getUserAchievements(userId);
            expect(achievements.get("streak")).toMatchObject({ league: 3, subTier: 1 });
        });
    });
});
