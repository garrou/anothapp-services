import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import AdminRepository from "../../../repositories/adminRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";
import { MAX_LOGIN_CODE_ATTEMPTS } from "../../../constants/security.js";

describe("AdminRepository (real Postgres)", () => {
    /** @type {AdminRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new AdminRepository();
    });

    describe("getNewUsersByDay", () => {
        it("counts users created within the window, grouped by day", async () => {
            await insertUser();
            await insertUser();

            const result = await repo.getNewUsersByDay(14);

            expect(result).toHaveLength(1);
            expect(result[0].count).toBe(2);
        });

        it("excludes users created before the window", async () => {
            const userId = await insertUser();
            await db.query(`UPDATE users SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1`, [userId]);

            const result = await repo.getNewUsersByDay(14);

            expect(result).toHaveLength(0);
        });
    });

    describe("getPendingDeletionsCount", () => {
        it("counts accounts within their grace period, excluding already-anonymized ones", async () => {
            const pendingId = await insertUser();
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [pendingId]);
            const anonymizedId = await insertUser();
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '40 days' WHERE id = $1`, [anonymizedId]);
            await db.query(`UPDATE users_auth SET email = 'deleted-' || user_id::text || '@anothapp.invalid' WHERE user_id = $1`, [anonymizedId]);
            await insertUser();

            const result = await repo.getPendingDeletionsCount();

            expect(result).toBe(1);
        });
    });

    describe("getAnonymizedCount", () => {
        it("counts accounts already anonymized", async () => {
            const userId = await insertUser();
            await db.query(`UPDATE users_auth SET email = 'deleted-' || user_id::text || '@anothapp.invalid' WHERE user_id = $1`, [userId]);
            await insertUser();

            const result = await repo.getAnonymizedCount();

            expect(result).toBe(1);
        });
    });

    describe("getActiveSessionsCount", () => {
        it("counts only live, unrevoked sessions", async () => {
            const userId = await insertUser();
            await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h1', NOW() + INTERVAL '1 day')`, [userId]);
            await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at) VALUES ($1, 'h2', NOW() + INTERVAL '1 day', NOW())`, [userId]);
            await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h3', NOW() - INTERVAL '1 day')`, [userId]);

            const result = await repo.getActiveSessionsCount();

            expect(result).toBe(1);
        });
    });

    describe("getSuspiciousLoginActivity", () => {
        it("lists accounts whose recent challenge maxed out the allowed attempts", async () => {
            const userId = await insertUser({ username: "MaxedOut" });
            await db.query(`
                INSERT INTO login_challenges (user_id, code_hash, expires_at, attempts)
                VALUES ($1, 'hash', NOW() + INTERVAL '10 minutes', $2)
            `, [userId, MAX_LOGIN_CODE_ATTEMPTS]);
            await insertUser({ username: "Fine" });

            const result = await repo.getSuspiciousLoginActivity(1);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({ userId, username: "MaxedOut", maxedOutCount: 1 });
        });

        it("excludes challenges older than the window", async () => {
            const userId = await insertUser();
            await db.query(`
                INSERT INTO login_challenges (user_id, code_hash, expires_at, attempts, created_at)
                VALUES ($1, 'hash', NOW() + INTERVAL '10 minutes', $2, NOW() - INTERVAL '2 days')
            `, [userId, MAX_LOGIN_CODE_ATTEMPTS]);

            const result = await repo.getSuspiciousLoginActivity(1);

            expect(result).toHaveLength(0);
        });
    });

    describe("searchUsers", () => {
        it("matches by username or email, case-insensitively", async () => {
            const userId = await insertUser({ username: "SearchMe", email: "searchme@test.fr" });
            await insertUser({ username: "Unrelated", email: "unrelated@test.fr" });

            const byUsername = await repo.searchUsers("searchme", 10);
            const byEmail = await repo.searchUsers("SEARCHME@TEST.FR", 10);

            expect(byUsername).toEqual([{ id: userId, username: "SearchMe", email: "searchme@test.fr" }]);
            expect(byEmail).toEqual([{ id: userId, username: "SearchMe", email: "searchme@test.fr" }]);
        });

        it("respects the limit", async () => {
            await insertUser({ username: "Match1" });
            await insertUser({ username: "Match2" });

            const result = await repo.searchUsers("Match", 1);

            expect(result).toHaveLength(1);
        });
    });
});
