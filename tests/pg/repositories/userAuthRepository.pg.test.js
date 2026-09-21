import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import UserAuthRepository from "../../../repositories/userAuthRepository.js";
import ServiceError from "../../../helpers/serviceError.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("UserAuthRepository (real Postgres)", () => {
    /** @type {UserAuthRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserAuthRepository();
    });

    describe("getByUserId", () => {
        it("returns the auth row", async () => {
            const userId = await insertUser({ email: "adrien@test.fr" });

            const result = await repo.getByUserId(userId);

            expect(result.email).toBe("adrien@test.fr");
        });

        it("returns null for an unknown user id", async () => {
            const result = await repo.getByUserId("00000000-0000-0000-0000-000000000000");

            expect(result).toBeNull();
        });
    });

    describe("getByEmail", () => {
        it("matches case-insensitively", async () => {
            const userId = await insertUser({ email: "Someone@Example.com" });

            const result = await repo.getByEmail("someone@EXAMPLE.com");

            expect(result.userId).toBe(userId);
        });

        it("returns null when nothing matches", async () => {
            const result = await repo.getByEmail("nobody@example.com");

            expect(result).toBeNull();
        });
    });

    describe("findForLogin", () => {
        it("matches by username", async () => {
            const userId = await insertUser({ username: "IdentifierUser", email: "idu@test.fr" });

            const result = await repo.findForLogin("IdentifierUser");

            expect(result.id).toBe(userId);
            expect(result.email).toBe("idu@test.fr");
        });

        it("matches by email, case-insensitively", async () => {
            const userId = await insertUser({ username: "IdentifierUser2", email: "idu2@test.fr" });

            const result = await repo.findForLogin("IDU2@test.fr");

            expect(result.id).toBe(userId);
        });

        it("returns null when nothing matches", async () => {
            const result = await repo.findForLogin("nobody");

            expect(result).toBeNull();
        });
    });

    describe("create", () => {
        it("inserts the auth row", async () => {
            const res = await db.query(`INSERT INTO users (username) VALUES ('newuser') RETURNING id`);
            const userId = res.rows[0].id;

            const result = await repo.create(userId, "new@test.fr", "hash");

            expect(result).toBe(true);
            const auth = await repo.getByUserId(userId);
            expect(auth.email).toBe("new@test.fr");
            expect(auth.password).toBe("hash");
        });

        it("rejects a duplicate email with a unique-constraint error", async () => {
            await insertUser({ email: "taken@test.fr" });
            const res = await db.query(`INSERT INTO users (username) VALUES ('another') RETURNING id`);
            const userId = res.rows[0].id;

            await expect(repo.create(userId, "taken@test.fr", "hash")).rejects.toBeTruthy();
        });
    });

    describe("updateField", () => {
        it("updates an allowed field", async () => {
            const userId = await insertUser({ emailVerified: false });

            const result = await repo.updateField(userId, "email_verified", true);

            expect(result).toBe(true);
            const auth = await repo.getByUserId(userId);
            expect(auth.emailVerified).toBe(true);
        });

        it("rejects an invalid field to prevent SQL injection via column name", async () => {
            const userId = await insertUser();

            await expect(repo.updateField(userId, "id = (SELECT 1); --", "x")).rejects.toThrow(ServiceError);
        });
    });

    describe("confirmPendingEmail", () => {
        it("moves the pending email into email and clears it", async () => {
            const userId = await insertUser({ email: "old@test.fr" });
            await repo.updateField(userId, "pending_email", "new@test.fr");

            const result = await repo.confirmPendingEmail(userId);

            expect(result).toBe(true);
            const auth = await repo.getByUserId(userId);
            expect(auth.email).toBe("new@test.fr");
            expect(auth.pendingEmail).toBeNull();
        });

        it("returns false when there is no pending email", async () => {
            const userId = await insertUser();

            const result = await repo.confirmPendingEmail(userId);

            expect(result).toBe(false);
        });
    });
});
