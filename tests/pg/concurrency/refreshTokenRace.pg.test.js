import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import RefreshTokenRepository from "../../../repositories/refreshTokenRepository.js";
import AuthService from "../../../services/authService.js";
import SecurityHelper from "../../../helpers/security.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

// revoke() used to be an unconditional UPDATE with no guard against a token already being
// revoked, so two concurrent uses of the SAME still-valid refresh token (a replay, a retried
// request) could both pass the "is it still valid" check, both "succeed" at revoking, and both
// mint a brand new session from a token meant to be single-use. Plain `Promise.all` doesn't
// reliably reproduce this (the two find+revoke round trips tend to serialize in practice), so
// these tests force the interleaving to prove the fix (WHERE revoked_at IS NULL, see
// repositories/refreshTokenRepository.js) holds under the worst case.
describe("Refresh token reuse race (real Postgres, forced concurrency)", () => {
    /** @type {RefreshTokenRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new RefreshTokenRepository();
    });

    it("only one of two concurrent revokes of the same token succeeds", async () => {
        const userId = await insertUser();
        await repo.create(userId, "shared-hash", new Date(Date.now() + 86400000));
        const token = await repo.find("shared-hash");

        const results = await Promise.allSettled([
            repo.revoke(token.id),
            repo.revoke(token.id),
        ]);

        expect(results.map((r) => r.value).sort()).toEqual([false, true]);
    });

    it("authService.refreshToken: a concurrently-replayed token mints only one new session", async () => {
        process.env.JWT_SECRET = "test-secret";
        const userId = await insertUser();
        const rawToken = SecurityHelper.generateRefreshToken();
        await repo.create(userId, SecurityHelper.hashToken(rawToken), new Date(Date.now() + 86400000));
        const serviceA = new AuthService();
        const serviceB = new AuthService();
        const originalFind = serviceB._refreshTokenRepository.find;
        // Delay only B's call after its own "is this token still valid" check resolves (still
        // valid, matching a genuine race) but before it acts on that answer - guaranteeing A's
        // call fully revokes and mints its session first.
        serviceB._refreshTokenRepository.find = async (...args) => {
            const result = await originalFind.apply(serviceB._refreshTokenRepository, args);
            await new Promise((resolve) => setTimeout(resolve, 50));
            return result;
        };

        const results = await Promise.allSettled([
            serviceA.refreshToken(rawToken),
            serviceB.refreshToken(rawToken),
        ]);

        expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
        expect(results[1].reason).toMatchObject({ status: 500 });
        const tokens = await db.query(`SELECT revoked_at FROM refresh_tokens WHERE user_id = $1`, [userId]);
        // The original (now revoked) plus exactly one new token - not two.
        expect(tokens.rowCount).toBe(2);
    });
});
