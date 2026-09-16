import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import db from "../../../config/db.js";
import AuthService from "../../../services/authService.js";
import SecurityHelper from "../../../helpers/security.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("AuthService (real Postgres)", () => {
    /** @type {AuthService} */
    let service;

    beforeAll(() => {
        process.env.JWT_SECRET = "test-secret";
    });

    beforeEach(async () => {
        await resetDb();
        service = new AuthService();
    });

    describe("register", () => {
        it("creates a new account", async () => {
            await service.register("new@test.fr", "NewUser", "GoodPassword1", "GoodPassword1");

            const res = await db.query(`SELECT username FROM users WHERE email = 'new@test.fr'`);
            expect(res.rows[0].username).toBe("NewUser");
        });

        it("rejects a duplicate email", async () => {
            await insertUser({ email: "taken@test.fr" });

            await expect(service.register("taken@test.fr", "AnotherUser", "GoodPassword1", "GoodPassword1"))
                .rejects.toMatchObject({ status: 409 });
        });

        it("rejects an invalid username", async () => {
            await expect(service.register("valid@test.fr", "ab", "GoodPassword1", "GoodPassword1"))
                .rejects.toMatchObject({ status: 400 });
        });
    });

    describe("login", () => {
        it("issues a session for correct credentials", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ username: "LoginUser", password: hash });

            const result = await service.login("LoginUser", "GoodPassword1");

            expect(result.token).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.user.id).toBe(userId);
            const tokens = await db.query(`SELECT * FROM refresh_tokens WHERE user_id = $1`, [userId]);
            expect(tokens.rowCount).toBe(1);
        });

        it("rejects a wrong password with the same generic error as an unknown user", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await insertUser({ username: "LoginUser2", password: hash });

            const wrongPassword = service.login("LoginUser2", "WrongPassword").catch((e) => e.status);
            const unknownUser = service.login("NobodyHere", "WrongPassword").catch((e) => e.status);

            expect(await wrongPassword).toBe(400);
            expect(await unknownUser).toBe(400);
        });

        it("returns a pendingDeletion cancellation token within the grace period, without opening a session", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ username: "PendingUser", password: hash });
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [userId]);

            const result = await service.login("PendingUser", "GoodPassword1");

            expect(result.pendingDeletion).toBe(true);
            expect(result.cancellationToken).toBeDefined();
            const tokens = await db.query(`SELECT * FROM refresh_tokens WHERE user_id = $1`, [userId]);
            expect(tokens.rowCount).toBe(0);
        });

        it("rejects login once the grace period has elapsed", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ username: "ExpiredUser", password: hash });
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '60 days' WHERE id = $1`, [userId]);

            await expect(service.login("ExpiredUser", "GoodPassword1")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("cancelDeletion", () => {
        it("cancels the deletion and issues a session from a valid cancellation token", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ username: "CancelUser", password: hash });
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [userId]);
            const { cancellationToken } = await service.login("CancelUser", "GoodPassword1");

            const result = await service.cancelDeletion(cancellationToken);

            expect(result.user.id).toBe(userId);
            const res = await db.query(`SELECT deleted_at FROM users WHERE id = $1`, [userId]);
            expect(res.rows[0]["deleted_at"]).toBeNull();
        });

        it("rejects a garbage token", async () => {
            await expect(service.cancelDeletion("not-a-real-token")).rejects.toThrow();
        });
    });

    describe("logout / refreshToken", () => {
        it("revokes the refresh token on logout", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ username: "LogoutUser", password: hash });
            const { refreshToken } = await service.login("LogoutUser", "GoodPassword1");

            await service.logout(refreshToken);

            const tokens = await db.query(`SELECT revoked_at FROM refresh_tokens WHERE user_id = $1`, [userId]);
            expect(tokens.rows[0]["revoked_at"]).not.toBeNull();
        });

        it("logout on an unknown token is a silent no-op", async () => {
            await expect(service.logout("does-not-exist")).resolves.toBeUndefined();
        });

        it("rotates the refresh token", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await insertUser({ username: "RefreshUser", password: hash });
            const { refreshToken } = await service.login("RefreshUser", "GoodPassword1");

            const result = await service.refreshToken(refreshToken);

            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).not.toBe(refreshToken);
            await expect(service.refreshToken(refreshToken)).rejects.toMatchObject({ status: 401 });
        });

        it("rejects refreshing with an unknown token", async () => {
            await expect(service.refreshToken("does-not-exist")).rejects.toMatchObject({ status: 401 });
        });
    });
});
