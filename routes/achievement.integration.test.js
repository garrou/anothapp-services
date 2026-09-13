import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";

const achievementServiceMocks = vi.hoisted(() => ({
    getAchievements: vi.fn(),
    getTierCatalog: vi.fn(),
}));

vi.mock("../services/achievementService.js", () => ({
    default: vi.fn().mockImplementation(function () { return achievementServiceMocks; }),
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

describe("GET /achievements", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/achievements");
        expect(res.status).toBe(401);
    });

    it("returns the current user's achievements", async () => {
        achievementServiceMocks.getAchievements.mockResolvedValue([{code: "streak", league: 1}]);

        const res = await request(app).get("/achievements").set("Cookie", cookie);

        expect(achievementServiceMocks.getAchievements).toHaveBeenCalledWith("user-1", undefined);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({achievements: [{code: "streak", league: 1}]});
    });
});

describe("GET /achievements/tiers", () => {
    it("returns the tier catalog", async () => {
        achievementServiceMocks.getTierCatalog.mockResolvedValue([{code: "streak", league: 1, subTier: 1, threshold: 5}]);

        const res = await request(app).get("/achievements/tiers").set("Cookie", cookie);

        expect(achievementServiceMocks.getTierCatalog).toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({tiers: [{code: "streak", league: 1, subTier: 1, threshold: 5}]});
    });
});
