import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import LoginChallengeRepository from "../../../repositories/loginChallengeRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("LoginChallengeRepository (real Postgres)", () => {
    /** @type {LoginChallengeRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new LoginChallengeRepository();
    });

    describe("create / getMostRecentByUserId", () => {
        it("creates a challenge and returns its id, retrievable as the most recent one", async () => {
            const userId = await insertUser();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            const id = await repo.create(userId, "hash", expiresAt);

            expect(id).toEqual(expect.any(String));
            const found = await repo.getMostRecentByUserId(userId);
            expect(found.id).toBe(id);
            expect(found.codeHash).toBe("hash");
            expect(found.attempts).toBe(0);
            expect(found.confirmedAt).toBeNull();
        });

        it("keeps every previous challenge (history), but only the most recent is returned", async () => {
            const userId = await insertUser();
            const older = await repo.create(userId, "old-hash", new Date(Date.now() + 10 * 60 * 1000));
            await new Promise((resolve) => setTimeout(resolve, 10));
            const newer = await repo.create(userId, "new-hash", new Date(Date.now() + 10 * 60 * 1000));

            const found = await repo.getMostRecentByUserId(userId);

            expect(found.id).toBe(newer);
            expect(found.id).not.toBe(older);
            const count = await db.query(`SELECT COUNT(*) AS total FROM login_challenges WHERE user_id = $1`, [userId]);
            expect(parseInt(count.rows[0].total)).toBe(2);
        });

        it("returns null when the account has never logged in", async () => {
            const userId = await insertUser();

            const found = await repo.getMostRecentByUserId(userId);

            expect(found).toBeNull();
        });
    });

    describe("incrementAttempts", () => {
        it("increments the attempt count", async () => {
            const userId = await insertUser();
            const id = await repo.create(userId, "hash", new Date(Date.now() + 10 * 60 * 1000));

            const result = await repo.incrementAttempts(userId, id);

            expect(result).toBe(true);
            const found = await repo.getMostRecentByUserId(userId);
            expect(found.attempts).toBe(1);
        });

        it("stops incrementing once MAX_LOGIN_CODE_ATTEMPTS is reached", async () => {
            const userId = await insertUser();
            const id = await repo.create(userId, "hash", new Date(Date.now() + 10 * 60 * 1000));

            for (let i = 0; i < 5; i++) {
                await repo.incrementAttempts(userId, id);
            }
            const result = await repo.incrementAttempts(userId, id);

            expect(result).toBe(false);
            const found = await repo.getMostRecentByUserId(userId);
            expect(found.attempts).toBe(5);
        });

        it("returns false for an unknown challenge id", async () => {
            const userId = await insertUser();

            const result = await repo.incrementAttempts(userId, "00000000-0000-0000-0000-000000000000");

            expect(result).toBe(false);
        });
    });

    describe("confirm", () => {
        it("marks the challenge confirmed when the code, id and account all match", async () => {
            const userId = await insertUser();
            const id = await repo.create(userId, "hash", new Date(Date.now() + 10 * 60 * 1000));

            const result = await repo.confirm(userId, id, "hash");

            expect(result).toBe(true);
            const found = await repo.getMostRecentByUserId(userId);
            expect(found.confirmedAt).not.toBeNull();
        });

        it("returns false and leaves the challenge open when the code doesn't match", async () => {
            const userId = await insertUser();
            const id = await repo.create(userId, "hash", new Date(Date.now() + 10 * 60 * 1000));

            const result = await repo.confirm(userId, id, "wrong-hash");

            expect(result).toBe(false);
            const found = await repo.getMostRecentByUserId(userId);
            expect(found.confirmedAt).toBeNull();
        });

        it("cannot confirm the same challenge twice - single-use", async () => {
            const userId = await insertUser();
            const id = await repo.create(userId, "hash", new Date(Date.now() + 10 * 60 * 1000));
            await repo.confirm(userId, id, "hash");

            const result = await repo.confirm(userId, id, "hash");

            expect(result).toBe(false);
        });

        it("refuses to confirm an expired challenge even with the right code", async () => {
            const userId = await insertUser();
            const id = await repo.create(userId, "hash", new Date(Date.now() - 1000));

            const result = await repo.confirm(userId, id, "hash");

            expect(result).toBe(false);
        });

        it("refuses to confirm a superseded (non-most-recent) challenge, even with its own correct code, enforced by the UPDATE itself and not just an earlier read", async () => {
            const userId = await insertUser();
            const staleId = await repo.create(userId, "old-hash", new Date(Date.now() + 10 * 60 * 1000));
            await repo.create(userId, "new-hash", new Date(Date.now() + 10 * 60 * 1000));

            const result = await repo.confirm(userId, staleId, "old-hash");

            expect(result).toBe(false);
        });
    });

    describe("deleteOlderThanDays", () => {
        it("deletes only the challenges older than the retention window", async () => {
            const userId = await insertUser();
            const recentId = await repo.create(userId, "hash", new Date(Date.now() + 10 * 60 * 1000));
            const oldId = await repo.create(userId, "old-hash", new Date(Date.now() + 10 * 60 * 1000));
            await db.query(`UPDATE login_challenges SET created_at = NOW() - INTERVAL '10 days' WHERE id = $1`, [oldId]);

            const deleted = await repo.deleteOlderThanDays(7);

            expect(deleted).toBe(1);
            const remaining = await db.query(`SELECT id FROM login_challenges WHERE user_id = $1`, [userId]);
            expect(remaining.rows.map((r) => r.id)).toEqual([recentId]);
        });
    });
});
