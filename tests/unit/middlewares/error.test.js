import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "../../../middlewares/error.js";
import ServiceError from "../../../helpers/serviceError.js";

const buildRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
});

describe("errorHandler", () => {
    it("uses a ServiceError's status and message, since it was written to be user-facing", () => {
        const res = buildRes();
        const err = new ServiceError(404, "Série introuvable");

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: "Série introuvable" });
    });

    it("hides an unexpected exception's own message behind a generic one, even with a 500 status", () => {
        const res = buildRes();
        const err = new TypeError("Cannot read properties of undefined");

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
    });

    it("hides a raw driver/library error's message too, e.g. a Postgres constraint violation", () => {
        // Not a real pg error, but shaped like one: a bare object with `message` and no `status`,
        // exactly what a rethrown, unwrapped exception from db.transaction looks like here.
        const res = buildRes();
        const err = { message: 'duplicate key value violates unique constraint "friends_pkey"' };

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
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
        const err = new ServiceError(0, "Weird case");

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
