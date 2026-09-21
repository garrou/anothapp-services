import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";

const userRepoMocks = vi.hoisted(() => ({
    createUser: vi.fn(),
    cancelDeletion: vi.fn(),
    getUserWithAuthById: vi.fn(),
}));
const userAuthRepoMocks = vi.hoisted(() => ({
    findForLogin: vi.fn(),
    getByUserId: vi.fn(),
    getByEmail: vi.fn(),
    updateField: vi.fn(),
    confirmPendingEmail: vi.fn(),
}));
const loginChallengeRepoMocks = vi.hoisted(() => ({
    create: vi.fn().mockResolvedValue("challenge-1"),
    getMostRecentByUserId: vi.fn(),
    incrementAttempts: vi.fn().mockResolvedValue(true),
    confirm: vi.fn().mockResolvedValue(true),
}));
const refreshRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    find: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
}));
const mailerServiceMocks = vi.hoisted(() => ({
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendLoginCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../../repositories/userAuthRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userAuthRepoMocks; }),
}));
vi.mock("../../../repositories/loginChallengeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return loginChallengeRepoMocks; }),
}));
vi.mock("../../../repositories/refreshTokenRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return refreshRepoMocks; }),
}));
vi.mock("../../../services/mailerService.js", () => ({
    default: vi.fn().mockImplementation(function () { return mailerServiceMocks; }),
}));

let app;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const module = await import("../../../config/app.js");
    app = module.default.app;
});

describe("POST /auth/login", () => {
    it("returns 400 when identifier/password are missing from the body (validated upfront)", async () => {
        const res = await request(app).post("/auth/login").send({});
        expect(res.status).toBe(400);
    });

    it("returns 200 with a pending-approval response, without setting auth cookies, when credentials are valid", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");

        userAuthRepoMocks.findForLogin.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: hash,
        });

        const res = await request(app)
            .post("/auth/login")
            .send({ identifier: "adrien@test.fr", password: "goodpassword" });

        expect(res.status).toBe(200);
        expect(res.body.pendingApproval).toBe(true);
        expect(res.body.approvalToken).toBeDefined();
        expect(res.headers["set-cookie"]).toBeUndefined();
    });
});

describe("POST /auth/confirm-login", () => {
    it("returns 200 and sets httpOnly cookies when the code matches the approval token", async () => {
        const approvalToken = SecurityHelper.signJwt("1", SecurityHelper.loginApprovalSecret(), "10m", { jti: "challenge-1" });
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue({
            id: "challenge-1",
            codeHash: SecurityHelper.hashLoginCode("123456"),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            attempts: 0,
            confirmedAt: null,
        });
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "1", username: "adrien", email: "adrien@test.fr", emailVerified: true,
        });
        loginChallengeRepoMocks.confirm.mockResolvedValue(true);
        refreshRepoMocks.create.mockResolvedValue(true);

        const res = await request(app)
            .post("/auth/confirm-login")
            .send({ approvalToken, code: "123456" });

        expect(res.status).toBe(200);
        expect(res.headers["set-cookie"].some((c) => c.startsWith("access_token="))).toBe(true);
        // the raw token must not leak into the body for a web client (cookies only)
        expect(res.body.token).toBeUndefined();
    });

    it("returns 401 without setting auth cookies for a code that doesn't match", async () => {
        const approvalToken = SecurityHelper.signJwt("1", SecurityHelper.loginApprovalSecret(), "10m", { jti: "challenge-1" });
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue({
            id: "challenge-1",
            codeHash: SecurityHelper.hashLoginCode("123456"),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            attempts: 0,
            confirmedAt: null,
        });
        loginChallengeRepoMocks.confirm.mockResolvedValue(false);

        const res = await request(app)
            .post("/auth/confirm-login")
            .send({ approvalToken, code: "000000" });

        expect(res.status).toBe(401);
        expect(res.headers["set-cookie"]).toBeUndefined();
    });
});

describe("POST /auth/login - pending deletion", () => {
    it("returns 200 with pendingDeletion, without setting auth cookies", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");

        userAuthRepoMocks.findForLogin.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: hash,
            deletedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const res = await request(app)
            .post("/auth/login")
            .send({ identifier: "adrien@test.fr", password: "goodpassword" });

        expect(res.status).toBe(200);
        expect(res.body.pendingDeletion).toBe(true);
        expect(res.body.cancellationToken).toBeDefined();
        expect(res.headers["set-cookie"]).toBeUndefined();
    });
});

describe("POST /auth/cancel-deletion", () => {
    it("returns 401 for an invalid cancellation token", async () => {
        const res = await request(app)
            .post("/auth/cancel-deletion")
            .send({ cancellationToken: "not-a-valid-token" });

        expect(res.status).toBe(401);
        expect(userRepoMocks.cancelDeletion).not.toHaveBeenCalled();
    });

    it("cancels the deletion and sets auth cookies with a valid token", async () => {
        const cancellationToken = SecurityHelper.signJwt("1", SecurityHelper.deletionCancellationSecret());
        userRepoMocks.cancelDeletion.mockResolvedValue(true);
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "1", username: "adrien", email: "adrien@test.fr", emailVerified: true,
        });
        refreshRepoMocks.create.mockResolvedValue(true);

        const res = await request(app)
            .post("/auth/cancel-deletion")
            .send({ cancellationToken });

        expect(res.status).toBe(200);
        expect(res.headers["set-cookie"].some((c) => c.startsWith("access_token="))).toBe(true);
    });
});

describe("POST /auth/verify-email", () => {
    it("is reachable without an access cookie/token", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.emailVerificationSecret());
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "adrien@test.fr", pendingEmail: null });
        userAuthRepoMocks.updateField.mockResolvedValue(true);

        const res = await request(app).post("/auth/verify-email").send({ token });

        expect(res.status).toBe(200);
    });

    it("returns 401 for an invalid token", async () => {
        const res = await request(app).post("/auth/verify-email").send({ token: "garbage" });

        expect(res.status).toBe(401);
    });
});

describe("POST /auth/forgot-password", () => {
    it("is reachable without an access cookie/token", async () => {
        userAuthRepoMocks.getByEmail.mockResolvedValue({ userId: "1", password: "hash" });

        const res = await request(app).post("/auth/forgot-password").send({ email: "adrien@test.fr" });

        expect(res.status).toBe(200);
        expect(mailerServiceMocks.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it("returns the same generic 200 when no account matches (no enumeration)", async () => {
        userAuthRepoMocks.getByEmail.mockResolvedValue(null);

        const res = await request(app).post("/auth/forgot-password").send({ email: "unknown@test.fr" });

        expect(res.status).toBe(200);
    });
});

describe("POST /auth/reset-password", () => {
    it("is reachable without an access cookie/token, and revokes existing sessions", async () => {
        userAuthRepoMocks.getByUserId.mockResolvedValue({ userId: "1", password: "old-hash" });
        const token = SecurityHelper.signJwt("1", SecurityHelper.passwordResetSecret("old-hash"));
        userAuthRepoMocks.updateField.mockResolvedValue(true);

        const res = await request(app)
            .post("/auth/reset-password")
            .send({ token, password: "NewPassword1", confirm: "NewPassword1" });

        expect(res.status).toBe(200);
        expect(refreshRepoMocks.revokeAllForUser).toHaveBeenCalledWith("1");
    });

    it("returns 401 for an invalid token", async () => {
        const res = await request(app)
            .post("/auth/reset-password")
            .send({ token: "garbage", password: "NewPassword1", confirm: "NewPassword1" });

        expect(res.status).toBe(401);
    });
});

describe("GET /auth/me", () => {
    it("returns 401 without an access cookie/token", async () => {
        const res = await request(app).get("/auth/me");
        expect(res.status).toBe(401);
    });
});

describe("default 404", () => {
    it("returns 404 on an unknown route", async () => {
        const res = await request(app).get("/unknown-route");
        expect(res.status).toBe(404);
    });
});
