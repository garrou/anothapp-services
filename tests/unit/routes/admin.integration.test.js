import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";

const userRepoMocks = vi.hoisted(() => ({
    getUserCount: vi.fn().mockResolvedValue(0),
}));
const refreshRepoMocks = vi.hoisted(() => ({
    revokeAllForUser: vi.fn().mockResolvedValue(0),
}));
const databaseRepoMocks = vi.hoisted(() => ({
    getDatabaseSize: vi.fn().mockResolvedValue("1 MB"),
    getSizeHistory: vi.fn().mockResolvedValue([]),
}));
const serviceCallCountRepoMocks = vi.hoisted(() => ({
    getAll: vi.fn().mockResolvedValue({
        mailer: { total: 0, history: [] },
        betaseries: { total: 0, history: [] },
        export: { total: 0, history: [] },
        import: { total: 0, history: [] },
    }),
}));
const catalogRepoMocks = vi.hoisted(() => ({
    getSizeHistory: vi.fn().mockResolvedValue([]),
}));
const adminRepoMocks = vi.hoisted(() => ({
    getNewUsersByDay: vi.fn().mockResolvedValue([]),
    getPendingDeletionsCount: vi.fn().mockResolvedValue(0),
    getAnonymizedCount: vi.fn().mockResolvedValue(0),
    getActiveSessionsCount: vi.fn().mockResolvedValue(0),
    getLoginChallengesReachingAttemptLimit: vi.fn().mockResolvedValue([]),
    searchUsers: vi.fn().mockResolvedValue([]),
}));
const adminActionRepoMocks = vi.hoisted(() => ({
    create: vi.fn().mockResolvedValue("action-1"),
    getRecent: vi.fn().mockResolvedValue([]),
}));
const healthServiceMocks = vi.hoisted(() => ({
    check: vi.fn().mockResolvedValue({ betaseries: { reachable: true }, mailer: { reachable: true } }),
}));
const dbMocks = vi.hoisted(() => ({
    transaction: vi.fn((callback) => callback({ query: vi.fn() })),
}));

vi.mock("../../../config/db.js", () => ({ default: dbMocks }));
vi.mock("../../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../../repositories/refreshTokenRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return refreshRepoMocks; }),
}));
vi.mock("../../../repositories/databaseRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return databaseRepoMocks; }),
}));
vi.mock("../../../repositories/serviceCallCountRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return serviceCallCountRepoMocks; }),
}));
vi.mock("../../../repositories/catalogRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return catalogRepoMocks; }),
}));
vi.mock("../../../repositories/adminRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return adminRepoMocks; }),
}));
vi.mock("../../../repositories/adminActionRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return adminActionRepoMocks; }),
}));
vi.mock("../../../services/healthService.js", () => ({
    default: vi.fn().mockImplementation(function () { return healthServiceMocks; }),
}));

let app;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    process.env.ADMIN_ID = "admin-1";
    const module = await import("../../../config/app.js");
    app = module.default.app;
});

const cookieFor = (userId) => {
    const token = SecurityHelper.signJwt(userId, process.env.JWT_SECRET);
    return `access_token=${token}`;
};

describe("GET /admin/dashboard", () => {
    it("returns 401 without a session", async () => {
        const res = await request(app).get("/admin/dashboard");
        expect(res.status).toBe(401);
    });

    it("returns 403 for a logged-in account that isn't the admin", async () => {
        const res = await request(app).get("/admin/dashboard").set("Cookie", cookieFor("user-1"));

        expect(res.status).toBe(403);
        expect(userRepoMocks.getUserCount).not.toHaveBeenCalled();
    });

    it("returns 200 with the aggregated dashboard for the admin account", async () => {
        const res = await request(app).get("/admin/dashboard").set("Cookie", cookieFor("admin-1"));

        expect(res.status).toBe(200);
        expect(res.body.database.size).toBe("1 MB");
        expect(res.body.health.betaseries.reachable).toBe(true);
    });
});

describe("GET /admin/users", () => {
    it("returns 403 for a non-admin account", async () => {
        const res = await request(app).get("/admin/users").query({ query: "bob" }).set("Cookie", cookieFor("user-1"));
        expect(res.status).toBe(403);
    });

    it("returns 200 for the admin account", async () => {
        adminRepoMocks.searchUsers.mockResolvedValueOnce([{ id: "user-1", username: "bob", email: "bob@test.fr" }]);

        const res = await request(app).get("/admin/users").query({ query: "bob" }).set("Cookie", cookieFor("admin-1"));

        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: "user-1", username: "bob", email: "bob@test.fr" }]);
    });
});

describe("POST /admin/users/:id/revoke-sessions", () => {
    it("returns 403 for a non-admin account, without revoking anything", async () => {
        const res = await request(app)
            .post("/admin/users/user-1/revoke-sessions")
            .set("Cookie", cookieFor("user-1"));

        expect(res.status).toBe(403);
        expect(refreshRepoMocks.revokeAllForUser).not.toHaveBeenCalled();
    });

    it("revokes the target's sessions and logs the action for the admin account", async () => {
        refreshRepoMocks.revokeAllForUser.mockResolvedValueOnce(2);

        const res = await request(app)
            .post("/admin/users/user-1/revoke-sessions")
            .set("Cookie", cookieFor("admin-1"));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ revokedCount: 2 });
        expect(refreshRepoMocks.revokeAllForUser).toHaveBeenCalledWith("user-1", expect.anything());
        expect(adminActionRepoMocks.create).toHaveBeenCalledWith("admin-1", "revoke_sessions", "user-1", expect.anything());
    });
});
