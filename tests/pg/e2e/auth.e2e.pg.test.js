import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import db from "../../../config/db.js";
import SecurityHelper from "../../../helpers/security.js";
import { resetDb } from "../resetDb.js";

// True end-to-end: the real Express app (config/app.js), real controllers/services/repositories,
// real Postgres - nothing mocked. MODE=dev is required for the auth cookies to be usable outside
// a real HTTPS connection (secure/sameSite=none otherwise, which no local HTTP client - browser or
// supertest - will send back), matching how this app is actually run locally.
//
// /auth/register and /auth/login are capped at 5 requests per 15 minutes per IP (see
// middlewares/rateLimit.js), and that limiter's state lives in this file's own module instance for
// the whole file (not reset between tests) - so only the tests that are actually ABOUT register/
// login go through those real endpoints. Every other flow (refresh, logout, protected-route access)
// seeds its user directly in the database with a real bcrypt hash, the same way SecurityHelper
// itself would produce it, so it's still exercising the real login verification path when it
// eventually happens - just not re-spending the shared register/login budget to get there.
describe("Auth journey (real Postgres, real HTTP)", () => {
    /** @type {import("express").Express} */
    let app;

    beforeAll(async () => {
        process.env.JWT_SECRET = "test-secret";
        const module = await import("../../../config/app.js");
        app = module.default.app;
    });

    describe("register", () => {
        it("creates an account", async () => {
            await resetDb();

            const res = await request(app).post("/auth/register").send({
                email: "newuser@test.fr", username: "NewUser", password: "GoodPassword1", confirm: "GoodPassword1",
            });

            expect(res.status).toBe(201);
            const found = await db.query(`SELECT username FROM users WHERE email = 'newuser@test.fr'`);
            expect(found.rows[0].username).toBe("NewUser");
        });

        it("rejects a duplicate email", async () => {
            await resetDb();
            await request(app).post("/auth/register").send({
                email: "dup@test.fr", username: "First", password: "GoodPassword1", confirm: "GoodPassword1",
            });

            const res = await request(app).post("/auth/register").send({
                email: "dup@test.fr", username: "Second", password: "GoodPassword1", confirm: "GoodPassword1",
            });

            expect(res.status).toBe(409);
        });

        it("rejects mismatched password confirmation", async () => {
            await resetDb();

            const res = await request(app).post("/auth/register").send({
                email: "mismatch@test.fr", username: "Mismatch", password: "GoodPassword1", confirm: "Different1",
            });

            expect(res.status).toBe(400);
        });
    });

    describe("login and protected route access", () => {
        it("rejects a protected route without any session", async () => {
            const res = await request(app).get("/auth/me");

            expect(res.status).toBe(401);
        });

        it("logs in and grants access to a protected route via the session cookie", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`INSERT INTO users (username, email, password) VALUES ('LoginUser', 'login@test.fr', $1)`, [hash]);
            const agent = request.agent(app);

            const loginRes = await agent.post("/auth/login").send({ identifier: "LoginUser", password: "GoodPassword1" });
            expect(loginRes.status).toBe(200);
            expect(loginRes.body.username).toBe("LoginUser");

            const meRes = await agent.get("/auth/me");
            expect(meRes.status).toBe(200);
        });

        it("rejects the wrong password", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`INSERT INTO users (username, email, password) VALUES ('WrongPassUser', 'wp@test.fr', $1)`, [hash]);

            const res = await request(app).post("/auth/login").send({ identifier: "WrongPassUser", password: "Incorrect1" });

            expect(res.status).toBe(400);
        });
    });

    describe("refresh and logout", () => {
        it("rotates the session via /auth/refresh, then logout revokes it", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`INSERT INTO users (username, email, password) VALUES ('SessionUser', 'session@test.fr', $1)`, [hash]);
            const agent = request.agent(app);
            await agent.post("/auth/login").send({ identifier: "SessionUser", password: "GoodPassword1" });

            const refreshRes = await agent.post("/auth/refresh");
            expect(refreshRes.status).toBe(204);

            const meAfterRefresh = await agent.get("/auth/me");
            expect(meAfterRefresh.status).toBe(200);

            const logoutRes = await agent.post("/auth/logout");
            expect(logoutRes.status).toBe(204);

            const meAfterLogout = await agent.get("/auth/me");
            expect(meAfterLogout.status).toBe(401);
        });
    });

    describe("account deletion request, pending login, and cancellation", () => {
        it("lets a pending-deletion user log back in via a cancellation token, restoring normal login", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userRes = await db.query(
                `INSERT INTO users (username, email, password) VALUES ('PendingUser', 'pending@test.fr', $1) RETURNING id`,
                [hash]
            );
            await db.query(`UPDATE users SET deleted_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [userRes.rows[0].id]);

            const pendingLoginRes = await request(app).post("/auth/login").send({ identifier: "PendingUser", password: "GoodPassword1" });
            expect(pendingLoginRes.status).toBe(200);
            expect(pendingLoginRes.body.pendingDeletion).toBe(true);
            const { cancellationToken } = pendingLoginRes.body;

            const cancelRes = await request(app).post("/auth/cancel-deletion").send({ cancellationToken });
            expect(cancelRes.status).toBe(200);
            expect(cancelRes.body.username).toBe("PendingUser");

            const normalLoginRes = await request(app).post("/auth/login").send({ identifier: "PendingUser", password: "GoodPassword1" });
            expect(normalLoginRes.status).toBe(200);
            expect(normalLoginRes.body.pendingDeletion).toBeUndefined();
        });
    });
});
