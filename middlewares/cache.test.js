import { describe, it, expect, vi } from "vitest";
import cacheMiddleware from "./cache.js";

const buildRes = (statusCode = 200) => ({
    statusCode,
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

    it("does not cache an error response, so the next request retries instead of replaying the failure", () => {
        const middleware = cacheMiddleware(1000);
        const url = "/shows/error-test-1";

        // first request: the upstream call failed, controller sends a 4xx/5xx body
        const req1 = { method: "GET", originalUrl: url };
        const res1 = buildRes(500);
        middleware(req1, res1, vi.fn());
        res1.json({ message: "Request failed with status code 403" });

        // second request: should be a miss again, not served the cached error
        const req2 = { method: "GET", originalUrl: url };
        const res2 = buildRes();
        const next2 = vi.fn();
        const originalJson2 = res2.json;

        middleware(req2, res2, next2);

        expect(next2).toHaveBeenCalledWith();
        expect(res2.json).not.toBe(originalJson2);
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

    it("bypasses the cache entirely when shouldCache returns false, on every request", () => {
        const middleware = cacheMiddleware(1000, false, (req) => Boolean(req.query.id));
        const url = "/stats/no-predicate-test";

        // first request: no ?id, opted out - never cached even though the response is sent
        const req1 = { method: "GET", originalUrl: url, query: {} };
        const res1 = buildRes();
        const next1 = vi.fn();
        middleware(req1, res1, next1);
        res1.json({ nbSeries: 10 });

        expect(next1).toHaveBeenCalledWith();

        // second request, same URL: still a miss, because nothing was ever cached for it
        const req2 = { method: "GET", originalUrl: url, query: {} };
        const res2 = buildRes();
        const next2 = vi.fn();
        const originalJson2 = res2.json;
        middleware(req2, res2, next2);

        expect(next2).toHaveBeenCalledWith();
        expect(res2.json).toBe(originalJson2);
    });

    it("caches when shouldCache returns true", () => {
        const middleware = cacheMiddleware(1000, false, (req) => Boolean(req.query.id));
        const url = "/stats/with-predicate-test";

        const req1 = { method: "GET", originalUrl: url, query: { id: "friend-1" } };
        const res1 = buildRes();
        middleware(req1, res1, vi.fn());
        res1.json({ nbSeries: 5 });

        const req2 = { method: "GET", originalUrl: url, query: { id: "friend-1" } };
        const res2 = buildRes();
        const next2 = vi.fn();
        middleware(req2, res2, next2);

        expect(next2).not.toHaveBeenCalled();
        expect(res2.json).toHaveBeenCalledWith({ nbSeries: 5 });
    });
});