import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import UserPlatformService from "../../../services/userPlatformService.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("UserPlatformService (real Postgres)", () => {
    /** @type {UserPlatformService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new UserPlatformService();
    });

    describe("addUserPlatforms / getUserPlatforms", () => {
        it("adds a platform and lists it back", async () => {
            const userId = await insertUser();

            await service.addUserPlatforms(userId, 1);

            const result = await service.getUserPlatforms(userId);
            expect(result).toEqual([1]);
        });
    });

    describe("getUserPlatforms for a friend", () => {
        it("returns the friend's platforms when they are accepted friends", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            await service.addUserPlatforms(friendId, 1);

            const result = await service.getUserPlatforms(userId, friendId);

            expect(result).toEqual([1]);
        });

        it("rejects when not friends", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();

            await expect(service.getUserPlatforms(userId, strangerId)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("deleteUserPlatform", () => {
        it("removes the platform", async () => {
            const userId = await insertUser();
            await service.addUserPlatforms(userId, 1);

            await service.deleteUserPlatform(userId, 1);

            expect(await service.getUserPlatforms(userId)).toEqual([]);
        });

        it("throws when there is nothing to remove", async () => {
            const userId = await insertUser();

            await expect(service.deleteUserPlatform(userId, 1)).rejects.toMatchObject({ status: 500 });
        });
    });
});
