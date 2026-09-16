import { describe, it, expect, beforeEach } from "vitest";
import UserPlatformRepository from "../../../repositories/userPlatformRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("UserPlatformRepository (real Postgres)", () => {
    /** @type {UserPlatformRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserPlatformRepository();
    });

    describe("addUserPlatforms", () => {
        it("links a platform to a user", async () => {
            const userId = await insertUser();

            const result = await repo.addUserPlatforms(userId, 1);

            expect(result).toBe(true);
            const platforms = await repo.getUserPlatforms(userId);
            expect(platforms).toEqual([1]);
        });
    });

    describe("getUserPlatforms", () => {
        it("returns every platform id linked to the user", async () => {
            const userId = await insertUser();
            await repo.addUserPlatforms(userId, 1);
            await repo.addUserPlatforms(userId, 2);

            const result = await repo.getUserPlatforms(userId);

            expect(result.sort()).toEqual([1, 2]);
        });

        it("only returns the requesting user's own platforms", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            await repo.addUserPlatforms(otherUserId, 1);

            const result = await repo.getUserPlatforms(userId);

            expect(result).toEqual([]);
        });
    });

    describe("deleteUserPlatforms", () => {
        it("removes the link between a user and a platform", async () => {
            const userId = await insertUser();
            await repo.addUserPlatforms(userId, 1);

            const result = await repo.deleteUserPlatforms(userId, 1);

            expect(result).toBe(true);
            const platforms = await repo.getUserPlatforms(userId);
            expect(platforms).toEqual([]);
        });

        it("returns false when the link does not exist", async () => {
            const userId = await insertUser();

            const result = await repo.deleteUserPlatforms(userId, 1);

            expect(result).toBe(false);
        });
    });
});
