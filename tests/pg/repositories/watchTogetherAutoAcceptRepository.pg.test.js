import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import WatchTogetherAutoAcceptRepository from "../../../repositories/watchTogetherAutoAcceptRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("WatchTogetherAutoAcceptRepository (real Postgres)", () => {
    /** @type {WatchTogetherAutoAcceptRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new WatchTogetherAutoAcceptRepository();
    });

    describe("enable / checkEnabled / disable", () => {
        it("is disabled by default", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();

            expect(await repo.checkEnabled(userId, friendId)).toBe(false);
        });

        it("enables and checks it, idempotently", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();

            await repo.enable(userId, friendId);
            await repo.enable(userId, friendId);

            expect(await repo.checkEnabled(userId, friendId)).toBe(true);
        });

        it("is directional - enabling user->friend does not enable friend->user", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();

            await repo.enable(userId, friendId);

            expect(await repo.checkEnabled(friendId, userId)).toBe(false);
        });

        it("disables it", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await repo.enable(userId, friendId);

            await repo.disable(userId, friendId);

            expect(await repo.checkEnabled(userId, friendId)).toBe(false);
        });

        it("disabling when never enabled is a no-op, not an error", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();

            await expect(repo.disable(userId, friendId)).resolves.toBeUndefined();
        });
    });

    describe("removeAllBetweenUsers", () => {
        it("clears the setting in both directions", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await repo.enable(userId, friendId);
            await repo.enable(friendId, userId);

            await repo.removeAllBetweenUsers(userId, friendId);

            expect(await repo.checkEnabled(userId, friendId)).toBe(false);
            expect(await repo.checkEnabled(friendId, userId)).toBe(false);
        });

        it("does not touch an unrelated pair", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const otherUserId = await insertUser();
            const otherFriendId = await insertUser();
            await repo.enable(userId, friendId);
            await repo.enable(otherUserId, otherFriendId);

            await repo.removeAllBetweenUsers(userId, friendId);

            expect(await repo.checkEnabled(otherUserId, otherFriendId)).toBe(true);
        });
    });

    it("cascades the deletion when either user account is deleted", async () => {
        const userId = await insertUser();
        const friendId = await insertUser();
        await repo.enable(userId, friendId);

        await db.query(`DELETE FROM users WHERE id = $1`, [friendId]);

        expect(await repo.checkEnabled(userId, friendId)).toBe(false);
    });
});
