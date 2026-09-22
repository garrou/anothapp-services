import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminService, { ADMIN_ACTION_REVOKE_SESSIONS } from "../../../services/adminService.js";

const userRepoMocks = vi.hoisted(() => ({
    getUserCount: vi.fn(),
}));
const refreshRepoMocks = vi.hoisted(() => ({
    revokeAllForUser: vi.fn(),
}));
const databaseRepoMocks = vi.hoisted(() => ({
    getDatabaseSize: vi.fn(),
    getSizeHistory: vi.fn(),
}));
const serviceCallCountRepoMocks = vi.hoisted(() => ({
    getAll: vi.fn(),
}));
const catalogRepoMocks = vi.hoisted(() => ({
    getSizeHistory: vi.fn(),
}));
const adminRepoMocks = vi.hoisted(() => ({
    getNewUsersByDay: vi.fn(),
    getPendingDeletionsCount: vi.fn(),
    getAnonymizedCount: vi.fn(),
    getActiveSessionsCount: vi.fn(),
    getLoginChallengesReachingAttemptLimit: vi.fn(),
    searchUsers: vi.fn(),
}));
const adminActionRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    getRecent: vi.fn(),
}));
const healthServiceMocks = vi.hoisted(() => ({
    check: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
    // runs the callback with a stand-in client - the mocked repositories below don't care what
    // they receive as their `client` argument, they just record it
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
vi.mock("../../../repositories/adminRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return adminRepoMocks; }),
}));
vi.mock("../../../repositories/adminActionRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return adminActionRepoMocks; }),
}));
vi.mock("../../../repositories/serviceCallCountRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return serviceCallCountRepoMocks; }),
}));
vi.mock("../../../repositories/catalogRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return catalogRepoMocks; }),
}));
vi.mock("../../../services/healthService.js", () => ({
    default: vi.fn().mockImplementation(function () { return healthServiceMocks; }),
}));

describe("AdminService.getDashboard", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AdminService();
    });

    it("aggregates every metric into a single object", async () => {
        userRepoMocks.getUserCount.mockResolvedValue(42);
        databaseRepoMocks.getDatabaseSize.mockResolvedValue("12 MB");
        databaseRepoMocks.getSizeHistory.mockResolvedValue([{ recordedAt: "2024-01-01", sizeBytes: 100 }]);
        catalogRepoMocks.getSizeHistory.mockResolvedValue([{ recordedAt: "2024-01-01", shows: 42, seasons: 100, episodes: 2000 }]);
        adminRepoMocks.getNewUsersByDay.mockResolvedValue([{ day: "2024-01-01", count: 3 }]);
        adminRepoMocks.getPendingDeletionsCount.mockResolvedValue(2);
        adminRepoMocks.getAnonymizedCount.mockResolvedValue(1);
        adminRepoMocks.getActiveSessionsCount.mockResolvedValue(10);
        adminRepoMocks.getLoginChallengesReachingAttemptLimit.mockResolvedValue([]);
        adminActionRepoMocks.getRecent.mockResolvedValue([]);
        healthServiceMocks.check.mockResolvedValue({ betaseries: { reachable: true }, mailer: { reachable: true } });
        serviceCallCountRepoMocks.getAll.mockResolvedValue({
            mailer: { total: 5, history: [{ day: "2024-01-01", count: 5 }] },
            betaseries: { total: 20, history: [{ day: "2024-01-01", count: 20 }] },
            export: { total: 1, history: [{ day: "2024-01-01", count: 1 }] },
            import: { total: 0, history: [] },
        });

        const result = await service.getDashboard();

        expect(result).toEqual({
            users: { total: 42, newByDay: [{ day: "2024-01-01", count: 3 }], pendingDeletions: 2, anonymized: 1 },
            sessions: { active: 10, loginAttemptLimit: [] },
            database: { size: "12 MB", history: [{ recordedAt: "2024-01-01", sizeBytes: 100 }] },
            catalog: { history: [{ recordedAt: "2024-01-01", shows: 42, seasons: 100, episodes: 2000 }] },
            health: { betaseries: { reachable: true }, mailer: { reachable: true } },
            recentActions: [],
            serviceCalls: {
                mailer: { total: 5, history: [{ day: "2024-01-01", count: 5 }] },
                betaseries: { total: 20, history: [{ day: "2024-01-01", count: 20 }] },
                export: { total: 1, history: [{ day: "2024-01-01", count: 1 }] },
                import: { total: 0, history: [] },
            },
        });
    });
});

describe("AdminService.searchUsers", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AdminService();
    });

    it("returns an empty array without querying when the query is too short", async () => {
        const result = await service.searchUsers("a");

        expect(result).toEqual([]);
        expect(adminRepoMocks.searchUsers).not.toHaveBeenCalled();
    });

    it("returns an empty array without querying when the query is missing", async () => {
        const result = await service.searchUsers(undefined);

        expect(result).toEqual([]);
        expect(adminRepoMocks.searchUsers).not.toHaveBeenCalled();
    });

    it("delegates to the repository for a valid query", async () => {
        adminRepoMocks.searchUsers.mockResolvedValue([{ id: "user-1", username: "bob", email: "bob@test.fr" }]);

        const result = await service.searchUsers("bob");

        expect(adminRepoMocks.searchUsers).toHaveBeenCalledWith("bob", expect.any(Number));
        expect(result).toEqual([{ id: "user-1", username: "bob", email: "bob@test.fr" }]);
    });
});

describe("AdminService.revokeUserSessions", () => {
    let service;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AdminService();
        client = { query: vi.fn() };
        dbMocks.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("revokes the target's sessions and logs the action against the acting admin, in the same transaction", async () => {
        refreshRepoMocks.revokeAllForUser.mockResolvedValue(3);

        const result = await service.revokeUserSessions("admin-1", "user-1");

        expect(refreshRepoMocks.revokeAllForUser).toHaveBeenCalledWith("user-1", client);
        expect(adminActionRepoMocks.create).toHaveBeenCalledWith(
            "admin-1", ADMIN_ACTION_REVOKE_SESSIONS, "user-1", client
        );
        expect(result).toEqual({ revokedCount: 3 });
    });

    it("still logs the action when the target had no active sessions", async () => {
        refreshRepoMocks.revokeAllForUser.mockResolvedValue(0);

        const result = await service.revokeUserSessions("admin-1", "user-2");

        expect(adminActionRepoMocks.create).toHaveBeenCalledWith(
            "admin-1", ADMIN_ACTION_REVOKE_SESSIONS, "user-2", client
        );
        expect(result).toEqual({ revokedCount: 0 });
    });

    it("never logs the action when revoking the sessions fails, since both happen in the same transaction", async () => {
        refreshRepoMocks.revokeAllForUser.mockRejectedValue(new Error("db down"));

        await expect(service.revokeUserSessions("admin-1", "user-1")).rejects.toThrow("db down");

        expect(adminActionRepoMocks.create).not.toHaveBeenCalled();
    });
});
