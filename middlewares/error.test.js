import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./error.js";

const buildRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
});

describe("errorHandler", () => {
    it("uses the error's status and message when both are present", () => {
        const res = buildRes();
        const err = { status: 404, message: "Série introuvable" };

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: "Série introuvable" });
    });

    it("defaults to 500 when the error has no status (e.g. an unexpected exception)", () => {
        const res = buildRes();
        const err = new TypeError("Cannot read properties of undefined");

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Cannot read properties of undefined" });
    });

    it("defaults to a generic message when the error has none", () => {
        const res = buildRes();
        const err = {};

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
    });

    it("treats status 0 as falsy and falls back to 500 (documents current behavior)", () => {
        // err.status || 500 means a literal 0 status - unlikely in practice,
        // but worth pinning down since it's a subtle falsy-value gotcha
        const res = buildRes();
        const err = { status: 0, message: "Weird case" };

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
    });
});