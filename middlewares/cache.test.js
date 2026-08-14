import { describe, it, expect, vi } from "vitest";
import cacheMiddleware from "./cache.js";

const buildRes = () => ({
    json: vi.fn((body) => body),
});

describe("cache middleware", () => {
    it("bypasses the cache entirely for non-GET requests", () => {
        const middleware = cacheMiddleware(1000);
        const req = { method: "POST", originalUrl: "/shows" };
        const res = buildRes();
        const next = vi.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("calls next() on a cache miss and wraps res.json to store the response", () => {
        const middleware = cacheMiddleware(1000);
        const req = { method: "GET", originalUrl: "/shows/miss-test-1" };
        const res = buildRes();
        const next = vi.fn();
        const originalJson = res.json;

        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        // res.json has been swapped out for the caching wrapper
        expect(res.json).not.toBe(originalJson);
    });

    it("serves the cached response directly on a subsequent hit, without calling next() again", () => {
        const middleware = cacheMiddleware(1000);
        const url = "/shows/hit-test-1";

        // first request: miss, wraps res.json; the controller then "sends" the response
        const req1 = { method: "GET", originalUrl: url };
        const res1 = buildRes();
        middleware(req1, res1, vi.fn());
        res1.json({ id: 1, title: "Breaking Bad" });

        // second request: hit, response served straight from the cache
        const req2 = { method: "GET", originalUrl: url };
        const res2 = buildRes();
        const next2 = vi.fn();
        middleware(req2, res2, next2);

        expect(next2).not.toHaveBeenCalled();
        expect(res2.json).toHaveBeenCalledWith({ id: 1, title: "Breaking Bad" });
    });

    it("keys the cache per user when eachUser is true, so two users don't share an entry", () => {
        const middleware = cacheMiddleware(1000, true);
        const url = "/shows/per-user-test";

        const req1 = { method: "GET", originalUrl: url, userId: "user-1" };
        const res1 = buildRes();
        middleware(req1, res1, vi.fn());
        res1.json({ owner: "user-1" });

        const req2 = { method: "GET", originalUrl: url, userId: "user-2" };
        const res2 = buildRes();
        const next2 = vi.fn();
        const originalJson2 = res2.json;

        middleware(req2, res2, next2);

        // different user, same URL -> should be a miss: next() is called and
        // res.json is wrapped again (cache.js reassigns res.json on a miss,
        // so it's no longer the original spy - can't assert on call args here,
        // only that it's not served straight from user-1's cached entry)
        expect(next2).toHaveBeenCalledWith();
        expect(res2.json).not.toBe(originalJson2);
    });
});