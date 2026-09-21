import { describe, it, expect, vi, beforeEach } from "vitest";
import db from "../../../config/db.js";
import AdminActionRepository from "../../../repositories/adminActionRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: { query: vi.fn(), transaction: vi.fn() },
}));

describe("AdminActionRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminActionRepository();
    });

    it("inserts the action and returns its id", async () => {
        db.query.mockResolvedValue({ rows: [{ id: "action-1" }] });

        const result = await repo.create("admin-1", "revoke_sessions", "user-1");

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO admin_actions"), ["admin-1", "revoke_sessions", "user-1"]
        );
        expect(result).toBe("action-1");
    });

    it("defaults targetUserId to null when omitted", async () => {
        db.query.mockResolvedValue({ rows: [{ id: "action-2" }] });

        await repo.create("admin-1", "some_action");

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["admin-1", "some_action", null]);
    });
});

describe("AdminActionRepository.getRecent", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AdminActionRepository();
    });

    it("returns the most recent actions, bounded by the given limit", async () => {
        db.query.mockResolvedValue({
            rows: [{
                id: "action-1", admin_user_id: "admin-1", action: "revoke_sessions",
                target_user_id: "user-1", created_at: "2024-01-01",
            }],
        });

        const result = await repo.getRecent(10);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY created_at DESC"), [10]);
        expect(result).toEqual([expect.objectContaining({ id: "action-1", adminUserId: "admin-1" })]);
    });

    it("defaults to 50 when no limit is given", async () => {
        db.query.mockResolvedValue({ rows: [] });

        await repo.getRecent();

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [50]);
    });
});
