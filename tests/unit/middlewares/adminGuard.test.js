import { describe, it, expect, vi, beforeAll } from "vitest";
import { checkAdmin } from "../../../middlewares/adminGuard.js";

beforeAll(() => {
    process.env.ADMIN_ID = "admin-1";
});

const buildRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
});

describe("checkAdmin", () => {
    it("returns 403 when req.userId doesn't match ADMIN_ID", () => {
        const req = { userId: "user-1" };
        const res = buildRes();
        const next = vi.fn();

        checkAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Accès refusé" });
        expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when req.userId is missing entirely", () => {
        const req = {};
        const res = buildRes();
        const next = vi.fn();

        checkAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it("calls next() when req.userId matches ADMIN_ID", () => {
        const req = { userId: "admin-1" };
        const res = buildRes();
        const next = vi.fn();

        checkAdmin(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });
});
