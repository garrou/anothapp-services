import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import UserRepository from "../../../repositories/userRepository.js";
import UserAuthRepository from "../../../repositories/userAuthRepository.js";
import ServiceError from "../../../helpers/serviceError.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("UserRepository (real Postgres)", () => {
    /** @type {UserRepository} */
    let repo;
    /** @type {UserAuthRepository} */
    let authRepo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserRepository();
        authRepo = new UserAuthRepository();
    });

    describe("createUser", () => {
        it("creates the business row and the auth row together, findable by email", async () => {
            const result = await repo.createUser("Someone@Example.com", "hash", "Someone");

            expect(result).toEqual(expect.any(String));
            const user = await repo.getUserById(result);
            expect(user.username).toBe("Someone");
            const auth = await authRepo.getByEmail("someone@EXAMPLE.com");
            expect(auth.userId).toBe(result);
        });

        it("rolls back the business row when the auth insert fails on a duplicate email, leaving the username free again", async () => {
            await repo.createUser("taken@example.com", "hash", "First");

            await expect(repo.createUser("taken@example.com", "hash", "Second")).rejects.toBeTruthy();

            const retry = await repo.createUser("taken2@example.com", "hash", "Second");
            expect(retry).toEqual(expect.any(String));
        });
    });

    describe("getUsersByUsername", () => {
        it("strict mode matches the exact username case-insensitively", async () => {
            await insertUser({ username: "JohnDoe" });

            const result = await repo.getUsersByUsername("johndoe", true);

            expect(result).toHaveLength(1);
            expect(result[0].username).toBe("JohnDoe");
        });

        it("non-strict mode matches a partial username", async () => {
            await insertUser({ username: "JohnDoe" });
            await insertUser({ username: "JaneDoe" });
            await insertUser({ username: "Unrelated" });

            const result = await repo.getUsersByUsername("doe");

            expect(result.map((u) => u.username).sort()).toEqual(["JaneDoe", "JohnDoe"]);
        });
    });

    describe("getUserById", () => {
        it("returns the user", async () => {
            const userId = await insertUser();

            const result = await repo.getUserById(userId);

            expect(result.id).toBe(userId);
        });

        it("returns null for an unknown id", async () => {
            const result = await repo.getUserById("00000000-0000-0000-0000-000000000000");

            expect(result).toBeNull();
        });
    });

    describe("getUserWithAuthById", () => {
        it("returns the business and auth fields merged from a single joined query", async () => {
            const userId = await insertUser({ username: "Joined", email: "joined@test.fr" });

            const result = await repo.getUserWithAuthById(userId);

            expect(result.id).toBe(userId);
            expect(result.username).toBe("Joined");
            expect(result.email).toBe("joined@test.fr");
            expect(result.emailVerified).toBe(true);
        });

        it("returns null for an unknown id", async () => {
            const result = await repo.getUserWithAuthById("00000000-0000-0000-0000-000000000000");

            expect(result).toBeNull();
        });
    });

    describe("getUserCount / getAllUserIds", () => {
        it("counts and lists every user", async () => {
            const a = await insertUser();
            const b = await insertUser();

            expect(await repo.getUserCount()).toBe(2);
            expect((await repo.getAllUserIds()).sort()).toEqual([a, b].sort());
        });
    });

    describe("hasEpisodeTrackingEnabled / getEpisodeTrackingByIds", () => {
        it("reflects each user's flag", async () => {
            const enabledUser = await insertUser({ episodeTrackingEnabled: true });
            const disabledUser = await insertUser({ episodeTrackingEnabled: false });

            expect(await repo.hasEpisodeTrackingEnabled(enabledUser)).toBe(true);
            expect(await repo.hasEpisodeTrackingEnabled(disabledUser)).toBe(false);

            const map = await repo.getEpisodeTrackingByIds([enabledUser, disabledUser]);
            expect(map.get(enabledUser)).toBe(true);
            expect(map.get(disabledUser)).toBe(false);
        });

        it("getEpisodeTrackingByIds returns an empty map for an empty list", async () => {
            const result = await repo.getEpisodeTrackingByIds([]);

            expect(result.size).toBe(0);
        });
    });

    describe("updateField", () => {
        it("updates an allowed field", async () => {
            const userId = await insertUser();

            const result = await repo.updateField(userId, "picture", "new-pic.jpg");

            expect(result).toBe(true);
            const user = await repo.getUserById(userId);
            expect(user.picture).toBe("new-pic.jpg");
        });

        it("rejects an invalid field to prevent SQL injection via column name", async () => {
            const userId = await insertUser();

            await expect(repo.updateField(userId, "id = (SELECT 1); --", "x")).rejects.toThrow(ServiceError);
        });
    });

    describe("markExported", () => {
        it("marks last_export when never exported before", async () => {
            const userId = await insertUser();

            const result = await repo.markExported(userId);

            expect(result).toBe(true);
        });

        it("refuses to mark again within the same day", async () => {
            const userId = await insertUser();
            await repo.markExported(userId);

            const result = await repo.markExported(userId);

            expect(result).toBe(false);
        });

        it("allows marking again after the cooldown has passed", async () => {
            const userId = await insertUser();
            await repo.markExported(userId);
            await db.query(`UPDATE users SET last_export = NOW() - INTERVAL '2 days' WHERE id = $1`, [userId]);

            const result = await repo.markExported(userId);

            expect(result).toBe(true);
        });
    });

    describe("requestDeletion / cancelDeletion", () => {
        it("marks the account as pending deletion and revokes active refresh tokens", async () => {
            const userId = await insertUser();
            await db.query(`
                INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h1', NOW() + INTERVAL '1 day')
            `, [userId]);

            const result = await repo.requestDeletion(userId);

            expect(result).toBe(true);
            const user = await repo.getUserById(userId);
            expect(user.deletedAt).not.toBeNull();
            const tokens = await db.query(`SELECT revoked_at FROM refresh_tokens WHERE user_id = $1`, [userId]);
            expect(tokens.rows[0]["revoked_at"]).not.toBeNull();
        });

        it("cancels a pending deletion", async () => {
            const userId = await insertUser();
            await repo.requestDeletion(userId);

            const result = await repo.cancelDeletion(userId);

            expect(result).toBe(true);
            const user = await repo.getUserById(userId);
            expect(user.deletedAt).toBeNull();
        });

        it("refuses to cancel once the account has already been anonymized", async () => {
            const userId = await insertUser();
            await repo.requestDeletion(userId);
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '31 days' WHERE id = $1`, [userId]);
            await db.query(`
                UPDATE users_auth SET email = 'deleted-' || user_id::text || '@anothapp.invalid'
                WHERE user_id = $1
            `, [userId]);

            const result = await repo.cancelDeletion(userId);

            expect(result).toBe(false);
        });
    });

    describe("anonymizeEligibleAccounts", () => {
        it("anonymizes both the business and auth rows once the grace period has elapsed", async () => {
            const userId = await insertUser({ email: "old@test.fr", username: "OldUser" });
            await repo.requestDeletion(userId);
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '31 days' WHERE id = $1`, [userId]);

            const result = await repo.anonymizeEligibleAccounts(30);

            expect(result).toBe(1);
            const user = await repo.getUserById(userId);
            expect(user.username).not.toBe("OldUser");
            expect(user.picture).toBeNull();
            const auth = await authRepo.getByUserId(userId);
            expect(auth.email).toBe(`deleted-${userId}@anothapp.invalid`);
        });

        it("does not touch accounts still within the grace period", async () => {
            const userId = await insertUser({ email: "recent@test.fr" });
            await repo.requestDeletion(userId);

            const result = await repo.anonymizeEligibleAccounts(30);

            expect(result).toBe(0);
            const auth = await authRepo.getByUserId(userId);
            expect(auth.email).toBe("recent@test.fr");
        });

        it("does not touch accounts that were never deleted", async () => {
            await insertUser();

            const result = await repo.anonymizeEligibleAccounts(30);

            expect(result).toBe(0);
        });
    });
});
