import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";
import ServiceError from "../helpers/serviceError.js";

const episodeServiceMocks = vi.hoisted(() => ({
    getViewedByMonthAgo: vi.fn(),
    updateViewing: vi.fn(),
    deleteViewing: vi.fn(),
}));

vi.mock("../services/episodeService.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeServiceMocks; }),
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

describe("GET /episodes", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/episodes");
        expect(res.status).toBe(401);
    });

    it("returns the viewed timeline", async () => {
        episodeServiceMocks.getViewedByMonthAgo.mockResolvedValue([{episode: {id: 1}}]);

        const res = await request(app).get("/episodes").query({month: "3"}).set("Cookie", cookie);

        expect(episodeServiceMocks.getViewedByMonthAgo).toHaveBeenCalledWith("user-1", "3");
        expect(res.status).toBe(200);
    });
});

describe("PATCH /episodes/:id", () => {
    it("returns 200 on success", async () => {
        episodeServiceMocks.updateViewing.mockResolvedValue(undefined);

        const res = await request(app).patch("/episodes/1").set("Cookie", cookie).send({watchedAt: "2024-01-01"});

        expect(episodeServiceMocks.updateViewing).toHaveBeenCalledWith("user-1", "1", "2024-01-01");
        expect(res.status).toBe(200);
    });

    it("returns 404 when the viewing doesn't belong to the user", async () => {
        episodeServiceMocks.updateViewing.mockRejectedValue(new ServiceError(404, "Visionnage introuvable"));

        const res = await request(app).patch("/episodes/999").set("Cookie", cookie).send({watchedAt: "2024-01-01"});

        expect(res.status).toBe(404);
    });
});

describe("DELETE /episodes/:id", () => {
    it("returns 204 on success", async () => {
        episodeServiceMocks.deleteViewing.mockResolvedValue(undefined);

        const res = await request(app).delete("/episodes/1").set("Cookie", cookie);

        expect(episodeServiceMocks.deleteViewing).toHaveBeenCalledWith("user-1", "1");
        expect(res.status).toBe(204);
    });
});
