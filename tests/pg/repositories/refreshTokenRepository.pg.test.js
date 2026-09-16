import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import RefreshTokenRepository from "../../../repositories/refreshTokenRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("RefreshTokenRepository (real Postgres)", () => {
    /** @type {RefreshTokenRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new RefreshTokenRepository();
    });

    describe("create", () => {
        it("inserts a new refresh token for the user", async () => {
            const userId = await insertUser();

            const result = await repo.create(userId, "hash123", new Date(Date.now() + 86400000));

            expect(result).toBe(true);
            const found = await repo.find("hash123");
            expect(found.userId).toBe(userId);
        });
    });

    describe("find", () => {
        it("returns the token when it is valid, unexpired and unrevoked", async () => {
            const userId = await insertUser();
            await repo.create(userId, "validhash", new Date(Date.now() + 86400000));

            const result = await repo.find("validhash");

            expect(result.userId).toBe(userId);
            expect(result.tokenHash).toBe("validhash");
            expect(result.revokedAt).toBeNull();
        });

        it("returns null for an expired token", async () => {
            const userId = await insertUser();
            await repo.create(userId, "expiredhash", new Date(Date.now() - 1000));

            const result = await repo.find("expiredhash");

            expect(result).toBeNull();
        });

        it("returns null for a revoked token", async () => {
            const userId = await insertUser();
            await repo.create(userId, "revokedhash", new Date(Date.now() + 86400000));
            const created = await repo.find("revokedhash");
            await repo.revoke(created.id);

            const result = await repo.find("revokedhash");

            expect(result).toBeNull();
        });

        it("returns null when no token matches the hash", async () => {
            const result = await repo.find("doesnotexist");

            expect(result).toBeNull();
        });
    });

    describe("revoke", () => {
        it("marks the token as revoked", async () => {
            const userId = await insertUser();
            await repo.create(userId, "tobevoked", new Date(Date.now() + 86400000));
            const token = await repo.find("tobevoked");

            const result = await repo.revoke(token.id);

            expect(result).toBe(true);
            const res = await db.query(`SELECT revoked_at FROM refresh_tokens WHERE id = $1`, [token.id]);
            expect(res.rows[0]["revoked_at"]).not.toBeNull();
        });

        it("returns false when the token id does not exist", async () => {
            const result = await repo.revoke("00000000-0000-0000-0000-000000000000");

            expect(result).toBe(false);
        });

        it("returns false when the token is already revoked", async () => {
            const userId = await insertUser();
            await repo.create(userId, "alreadyrevoked", new Date(Date.now() + 86400000));
            const token = await repo.find("alreadyrevoked");
            await repo.revoke(token.id);

            const result = await repo.revoke(token.id);

            expect(result).toBe(false);
        });
    });

    describe("deleteRevokedOlderThanDays", () => {
        it("deletes only revoked tokens older than the given number of days", async () => {
            const userId = await insertUser();
            await repo.create(userId, "oldrevoked", new Date(Date.now() + 86400000));
            await repo.create(userId, "recentrevoked", new Date(Date.now() + 86400000));
            await repo.create(userId, "stillactive", new Date(Date.now() + 86400000));
            await db.query(`
                UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '10 days' WHERE token_hash = 'oldrevoked'
            `);
            await db.query(`
                UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '1 hour' WHERE token_hash = 'recentrevoked'
            `);

            const result = await repo.deleteRevokedOlderThanDays(5);

            expect(result).toBe(1);
            const remaining = await db.query(`SELECT token_hash FROM refresh_tokens ORDER BY token_hash`);
            expect(remaining.rows.map((r) => r.token_hash)).toEqual(["recentrevoked", "stillactive"]);
        });

        it("returns 0 when there is nothing to delete", async () => {
            const result = await repo.deleteRevokedOlderThanDays(5);

            expect(result).toBe(0);
        });
    });
});
