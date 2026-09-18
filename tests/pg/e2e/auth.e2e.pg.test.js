import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import db from "../../../config/db.js";
import SecurityHelper from "../../../helpers/security.js";
import MailerService from "../../../services/mailerService.js";
import { loginLimiter, confirmLoginLimiter, registerLimiter } from "../../../middlewares/rateLimit.js";
import { resetDb } from "../resetDb.js";

// EMAIL_HOST is unset in this test env, so MailerService logs instead of really sending the
// reset link - this test signs the same token the server would have emailed, using the same
// secret derivation, and feeds it back into the real reset endpoint.
// the reset secret is derived from the account's *current* password hash (see
// SecurityHelper.passwordResetSecret), so it has to be looked up right before signing
const signReset = async (userId) => {
    const { rows } = await db.query(`SELECT password FROM users WHERE id = $1`, [userId]);
    return SecurityHelper.signJwt(userId, SecurityHelper.passwordResetSecret(rows[0].password), "1h");
};
// unlike the verification/reset links, the login code is random and only known by whatever
// receives the email - so instead of re-deriving it, this spies on the mailer to capture the
// code the server actually generated and would have sent.
const login = async (requester, identifier, password) => {
    const spy = vi.spyOn(MailerService.prototype, "sendLoginCodeEmail");
    const res = await requester.post("/auth/login").send({ identifier, password });
    const code = spy.mock.calls.at(-1)?.[1];
    spy.mockRestore();
    return { res, code };
};
// full round trip: login, then confirm the captured code - only valid when login actually
// issued a pendingApproval (a wrong password or a pending-deletion account won't).
const loginAndConfirm = async (requester, identifier, password) => {
    const { res: loginRes, code } = await login(requester, identifier, password);
    const confirmRes = await requester.post("/auth/confirm-login").send({ approvalToken: loginRes.body.approvalToken, code });
    return { loginRes, confirmRes };
};

// True end-to-end: the real Express app (config/app.js), real controllers/services/repositories,
// real Postgres - nothing mocked. MODE=dev is required for the auth cookies to be usable outside
// a real HTTPS connection (secure/sameSite=none otherwise, which no local HTTP client - browser or
// supertest - will send back), matching how this app is actually run locally.
//
// /auth/login and /auth/confirm-login are capped at 5 and 10 requests per 15 minutes per IP (see
// middlewares/rateLimit.js) - every supertest request against an Express app hits that limiter as
// the same key ("127.0.0.1", however the loopback address is spelled), so it's reset before every
// test here rather than shared across the whole file.
describe("Auth journey (real Postgres, real HTTP)", () => {
    /** @type {import("express").Express} */
    let app;

    beforeAll(async () => {
        process.env.JWT_SECRET = "test-secret";
        const module = await import("../../../config/app.js");
        app = module.default.app;
    });

    beforeEach(() => {
        loginLimiter.resetKey("127.0.0.1");
        confirmLoginLimiter.resetKey("127.0.0.1");
        registerLimiter.resetKey("127.0.0.1");
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

        it("logs in and grants access to a protected route via the session cookie, once the code is confirmed", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`
                INSERT INTO users (username, email, password, email_verified) VALUES ('LoginUser', 'login@test.fr', $1, TRUE)
            `, [hash]);
            const agent = request.agent(app);

            const { loginRes, confirmRes } = await loginAndConfirm(agent, "LoginUser", "GoodPassword1");
            expect(loginRes.status).toBe(200);
            expect(loginRes.body.pendingApproval).toBe(true);
            expect(confirmRes.status).toBe(200);
            expect(confirmRes.body.username).toBe("LoginUser");

            const meRes = await agent.get("/auth/me");
            expect(meRes.status).toBe(200);
        });

        it("rejects the wrong password", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`
                INSERT INTO users (username, email, password, email_verified) VALUES ('WrongPassUser', 'wp@test.fr', $1, TRUE)
            `, [hash]);

            const res = await request(app).post("/auth/login").send({ identifier: "WrongPassUser", password: "Incorrect1" });

            expect(res.status).toBe(400);
        });
    });

    describe("refresh and logout", () => {
        it("rotates the session via /auth/refresh, then logout revokes it", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`
                INSERT INTO users (username, email, password, email_verified) VALUES ('SessionUser', 'session@test.fr', $1, TRUE)
            `, [hash]);
            const agent = request.agent(app);
            await loginAndConfirm(agent, "SessionUser", "GoodPassword1");

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
                `INSERT INTO users (username, email, password, email_verified)
                 VALUES ('PendingUser', 'pending@test.fr', $1, TRUE) RETURNING id`,
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

            const { res: normalLoginRes } = await login(request(app), "PendingUser", "GoodPassword1");
            expect(normalLoginRes.status).toBe(200);
            expect(normalLoginRes.body.pendingDeletion).toBeUndefined();
            expect(normalLoginRes.body.pendingApproval).toBe(true);
        });
    });

    describe("login confirmation", () => {
        it("returns the exact same pending-approval response for a verified and an unverified account", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`
                INSERT INTO users (username, email, password, email_verified) VALUES ('Verified', 'verified@test.fr', $1, TRUE)
            `, [hash]);
            await db.query(`
                INSERT INTO users (username, email, password, email_verified) VALUES ('Unverified', 'unverified@test.fr', $1, FALSE)
            `, [hash]);

            const { res: verifiedRes } = await login(request(app), "Verified", "GoodPassword1");
            const { res: unverifiedRes } = await login(request(app), "Unverified", "GoodPassword1");

            expect(verifiedRes.status).toBe(200);
            expect(unverifiedRes.status).toBe(200);
            expect(Object.keys(verifiedRes.body).sort()).toEqual(Object.keys(unverifiedRes.body).sort());
            expect(unverifiedRes.body.pendingApproval).toBe(true);
        });

        it("confirms a brand-new account's email as part of its very first login", async () => {
            await resetDb();
            const res = await request(app).post("/auth/register").send({
                email: "newlogin@test.fr", username: "NewLogin", password: "GoodPassword1", confirm: "GoodPassword1",
            });
            expect(res.status).toBe(201);
            const { id: userId } = (await db.query(`SELECT id FROM users WHERE email = 'newlogin@test.fr'`)).rows[0];
            const before = await db.query(`SELECT email_verified FROM users WHERE id = $1`, [userId]);
            expect(before.rows[0]["email_verified"]).toBe(false);

            const { loginRes, confirmRes } = await loginAndConfirm(request(app), "NewLogin", "GoodPassword1");
            expect(loginRes.status).toBe(200);
            expect(loginRes.body.pendingApproval).toBe(true);
            expect(confirmRes.status).toBe(200);
            expect(confirmRes.body.username).toBe("NewLogin");

            const after = await db.query(`SELECT email_verified FROM users WHERE id = $1`, [userId]);
            expect(after.rows[0]["email_verified"]).toBe(true);
        });

        it("rejects a code that doesn't match the approval token", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("GoodPassword1");
            await db.query(`
                INSERT INTO users (username, email, password, email_verified) VALUES ('BadCode', 'badcode@test.fr', $1, TRUE)
            `, [hash]);

            const { res: loginRes } = await login(request(app), "BadCode", "GoodPassword1");
            const confirmRes = await request(app).post("/auth/confirm-login").send({
                approvalToken: loginRes.body.approvalToken, code: "000000",
            });

            expect(confirmRes.status).toBe(401);
        });
    });

    describe("forgot / reset password", () => {
        it("resets the password via a valid token and revokes existing sessions", async () => {
            await resetDb();
            const hash = await SecurityHelper.createHash("OldPassword1");
            const userRes = await db.query(`
                INSERT INTO users (username, email, password, email_verified)
                VALUES ('ResetUser', 'reset@test.fr', $1, TRUE) RETURNING id
            `, [hash]);
            const userId = userRes.rows[0].id;
            const agent = request.agent(app);
            await loginAndConfirm(agent, "ResetUser", "OldPassword1");

            const forgotRes = await request(app).post("/auth/forgot-password").send({ email: "reset@test.fr" });
            expect(forgotRes.status).toBe(200);

            const resetRes = await request(app).post("/auth/reset-password").send({
                token: await signReset(userId), password: "NewPassword1", confirm: "NewPassword1",
            });
            expect(resetRes.status).toBe(200);

            // the still-live access token cookie keeps working until it naturally expires (stateless
            // JWTs can't be revoked mid-flight) - what revoking does is stop the session from being
            // renewable, so refreshing after it expires is what actually locks the old session out
            const refreshAfterReset = await agent.post("/auth/refresh");
            expect(refreshAfterReset.status).toBe(401);

            const loginWithOld = await request(app).post("/auth/login").send({ identifier: "ResetUser", password: "OldPassword1" });
            expect(loginWithOld.status).toBe(400);

            const { res: loginWithNew } = await login(request(app), "ResetUser", "NewPassword1");
            expect(loginWithNew.status).toBe(200);
            expect(loginWithNew.body.pendingApproval).toBe(true);
        });

        it("returns the same generic success response for an unknown email (no enumeration)", async () => {
            await resetDb();

            const res = await request(app).post("/auth/forgot-password").send({ email: "nobody@test.fr" });

            expect(res.status).toBe(200);
        });
    });
});
