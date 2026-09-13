import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";

const statServiceMocks = vi.hoisted(() => ({
    getStats: vi.fn(),
    getWrapped: vi.fn(),
    getLeaderboard: vi.fn(),
}));

vi.mock("../services/statService.js", () => ({
    default: vi.fn().mockImplementation(function () { return statServiceMocks; }),
}));

let app;
let cookie;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const module = await import("../config/app.js");
    app = module.default.app;
    cookie = `access_token=${SecurityHelper.signJwt("user-1", "test-secret")}`;
});

beforeEach(() => {
    vi.clearAllMocks();
});

// no `id` query param is passed in these requests - the /stats cache is opted out for a
// user's own data (see middlewares/cache.test.js for the caching behavior itself), so
// each request below reliably reaches the mocked service instead of a cached response.

describe("GET /stats", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/stats");
        expect(res.status).toBe(401);
    });

    it("returns the current user's stats", async () => {
        statServiceMocks.getStats.mockResolvedValue({totalShows: 10});

        const res = await request(app).get("/stats").set("Cookie", cookie);

        expect(statServiceMocks.getStats).toHaveBeenCalledWith("user-1", undefined);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({totalShows: 10});
    });
});

describe("GET /stats/wrapped", () => {
    it("returns the wrapped for the given year", async () => {
        statServiceMocks.getWrapped.mockResolvedValue({year: 2024, topShow: "Show"});

        const res = await request(app).get("/stats/wrapped").query({year: "2024"}).set("Cookie", cookie);

        expect(statServiceMocks.getWrapped).toHaveBeenCalledWith("user-1", "2024");
        expect(res.status).toBe(200);
    });
});

describe("GET /stats/leaderboard", () => {
    it("returns the leaderboard", async () => {
        statServiceMocks.getLeaderboard.mockResolvedValue([{id: "user-1", value: 10}]);

        const res = await request(app).get("/stats/leaderboard").set("Cookie", cookie);

        expect(statServiceMocks.getLeaderboard).toHaveBeenCalledWith("user-1");
        expect(res.status).toBe(200);
    });
});
