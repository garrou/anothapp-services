import { describe, it, expect, vi, beforeEach } from "vitest";
import db from "../../../config/db.js";
import AdminRepository from "../../../repositories/adminRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: { query: vi.fn(), transaction: vi.fn() },
}));

describe("AdminRepository.getNewUsersByDay", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminRepository();
    });

    it("returns the count of new users grouped by day", async () => {
        db.query.mockResolvedValue({ rows: [{ day: "2024-01-01", count: "3" }] });

        const result = await repo.getNewUsersByDay(14);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("date_trunc"), [14]);
        expect(result).toEqual([{ day: "2024-01-01", count: 3 }]);
    });
});

describe("AdminRepository.getPendingDeletionsCount", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminRepository();
    });

    it("returns the parsed count, excluding already-anonymized accounts", async () => {
        db.query.mockResolvedValue({ rows: [{ total: "4" }] });

        const result = await repo.getPendingDeletionsCount();

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("email NOT LIKE '%@anothapp.invalid'"));
        expect(result).toBe(4);
    });
});

describe("AdminRepository.getAnonymizedCount", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminRepository();
    });

    it("returns the parsed count", async () => {
        db.query.mockResolvedValue({ rows: [{ total: "7" }] });

        const result = await repo.getAnonymizedCount();

        expect(result).toBe(7);
    });
});

describe("AdminRepository.getActiveSessionsCount", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminRepository();
    });

    it("returns the parsed count of live, unrevoked sessions", async () => {
        db.query.mockResolvedValue({ rows: [{ total: "12" }] });

        const result = await repo.getActiveSessionsCount();

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("revoked_at IS NULL"));
        expect(result).toBe(12);
    });
});

describe("AdminRepository.getLoginChallengesReachingAttemptLimit", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminRepository();
    });

    it("returns accounts that maxed out login attempts recently", async () => {
        db.query.mockResolvedValue({
            rows: [{ user_id: "user-1", username: "bob", maxed_out_count: "2", last_attempt_at: "2024-01-01" }],
        });

        const result = await repo.getLoginChallengesReachingAttemptLimit(1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("attempts >= $2"), [1, 5]);
        expect(result).toEqual([{
            userId: "user-1", username: "bob", maxedOutCount: 2, lastAttemptAt: "2024-01-01",
        }]);
    });
});

describe("AdminRepository.searchUsers", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminRepository();
    });

    it("matches by username or email, case-insensitively", async () => {
        db.query.mockResolvedValue({
            rows: [{ id: "user-1", username: "bob", email: "bob@test.fr" }],
        });

        const result = await repo.searchUsers("bob", 10);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["%bob%", 10]);
        expect(result).toEqual([{ id: "user-1", username: "bob", email: "bob@test.fr" }]);
    });
});
