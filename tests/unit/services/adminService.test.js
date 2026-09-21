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
}));
const adminRepoMocks = vi.hoisted(() => ({
    getNewUsersByDay: vi.fn(),
    getPendingDeletionsCount: vi.fn(),
    getAnonymizedCount: vi.fn(),
    getActiveSessionsCount: vi.fn(),
    getSuspiciousLoginActivity: vi.fn(),
    searchUsers: vi.fn(),
}));
const adminActionRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    getRecent: vi.fn(),
}));
const healthServiceMocks = vi.hoisted(() => ({
    check: vi.fn(),
}));

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
        adminRepoMocks.getNewUsersByDay.mockResolvedValue([{ day: "2024-01-01", count: 3 }]);
        adminRepoMocks.getPendingDeletionsCount.mockResolvedValue(2);
        adminRepoMocks.getAnonymizedCount.mockResolvedValue(1);
        adminRepoMocks.getActiveSessionsCount.mockResolvedValue(10);
        adminRepoMocks.getSuspiciousLoginActivity.mockResolvedValue([]);
        adminActionRepoMocks.getRecent.mockResolvedValue([]);
        healthServiceMocks.check.mockResolvedValue({ betaseries: { reachable: true }, mailer: { reachable: true } });

        const result = await service.getDashboard();

        expect(result).toEqual({
            userCount: 42,
            databaseSize: "12 MB",
            newUsersByDay: [{ day: "2024-01-01", count: 3 }],
            pendingDeletions: 2,
            anonymizedAccounts: 1,
            activeSessions: 10,
            suspiciousLogins: [],
            recentActions: [],
            health: { betaseries: { reachable: true }, mailer: { reachable: true } },
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

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AdminService();
    });

    it("revokes the target's sessions and logs the action against the acting admin", async () => {
        refreshRepoMocks.revokeAllForUser.mockResolvedValue(3);

        const result = await service.revokeUserSessions("admin-1", "user-1");

        expect(refreshRepoMocks.revokeAllForUser).toHaveBeenCalledWith("user-1");
        expect(adminActionRepoMocks.create).toHaveBeenCalledWith("admin-1", ADMIN_ACTION_REVOKE_SESSIONS, "user-1");
        expect(result).toEqual({ revokedCount: 3 });
    });

    it("still logs the action when the target had no active sessions", async () => {
        refreshRepoMocks.revokeAllForUser.mockResolvedValue(0);

        const result = await service.revokeUserSessions("admin-1", "user-2");

        expect(adminActionRepoMocks.create).toHaveBeenCalledWith("admin-1", ADMIN_ACTION_REVOKE_SESSIONS, "user-2");
        expect(result).toEqual({ revokedCount: 0 });
    });
});
