import { describe, it, expect, vi, beforeAll } from "vitest";
import { checkJwt } from "./guard.js";
import SecurityHelper from "../helpers/security.js";

const SECRET = "test-secret";

beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
});

const buildReq = ({ url = "/shows", cookies = {}, headers = {} } = {}) => ({
    originalUrl: url,
    query: {},
    cookies,
    headers,
});

const buildRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
});

describe("checkJwt", () => {
    it("lets a whitelisted route through without checking for a token", () => {
        const req = buildReq({ url: "/auth/login" });
        const res = buildRes();
        const next = vi.fn();

        checkJwt(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });

    it("matches whitelisted prefixes, not just exact paths", () => {
        const req = buildReq({ url: "/search/images?q=test" });
        const res = buildRes();
        const next = vi.fn();

        checkJwt(req, res, next);

        expect(next).toHaveBeenCalledWith();
    });

    it("returns 401 when no token is present on a protected route", () => {
        const req = buildReq({ url: "/shows" });
        const res = buildRes();
        const next = vi.fn();

        checkJwt(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Utilisateur non connecté" });
        expect(next).not.toHaveBeenCalled();
    });

    it("calls next(err) with a 401 ServiceError when the token is invalid", () => {
        const req = buildReq({ url: "/shows", cookies: { access_token: "not-a-valid-jwt" } });
        const res = buildRes();
        const next = vi.fn();

        checkJwt(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err.status).toBe(401);
    });

    it("sets req.userId and calls next() with a valid token in the access_token cookie", () => {
        const token = SecurityHelper.signJwt("user-1", SECRET);
        const req = buildReq({ url: "/shows", cookies: { access_token: token } });
        const res = buildRes();
        const next = vi.fn();

        checkJwt(req, res, next);

        expect(req.userId).toBe("user-1");
        expect(next).toHaveBeenCalledWith();
    });

    it("also accepts a valid token via the Authorization Bearer header", () => {
        const token = SecurityHelper.signJwt("user-2", SECRET);
        const req = buildReq({ url: "/shows", headers: { authorization: `Bearer ${token}` } });
        const res = buildRes();
        const next = vi.fn();

        checkJwt(req, res, next);

        expect(req.userId).toBe("user-2");
        expect(next).toHaveBeenCalledWith();
    });

    it("prefers the cookie over the header when both are present", () => {
        const cookieToken = SecurityHelper.signJwt("cookie-user", SECRET);
        const headerToken = SecurityHelper.signJwt("header-user", SECRET);
        const req = buildReq({
            url: "/shows",
            cookies: { access_token: cookieToken },
            headers: { authorization: `Bearer ${headerToken}` },
        });
        const res = buildRes();
        const next = vi.fn();

        checkJwt(req, res, next);

        expect(req.userId).toBe("cookie-user");
    });
});