import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../../../helpers/security.js";
import ServiceError from "../../../helpers/serviceError.js";

const seasonServiceMocks = vi.hoisted(() => ({
    deleteBySeasonId: vi.fn(),
    getEpisodesBySeasonId: vi.fn(),
    addEpisodeViewing: vi.fn(),
    addAllEpisodesViewing: vi.fn(),
    updateBySeasonId: vi.fn(),
    updateWatchedWith: vi.fn(),
    getPendingWatchedWith: vi.fn(),
    getActiveWatchedWith: vi.fn(),
    respondToWatchedWith: vi.fn(),
}));

vi.mock("../../../services/seasonService.js", () => ({
    default: vi.fn().mockImplementation(function () { return seasonServiceMocks; }),
}));

let app;
let cookie;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const module = await import("../../../config/app.js");
    app = module.default.app;
    cookie = `access_token=${SecurityHelper.signJwt("user-1", "test-secret")}`;
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /seasons/:id/episodes", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/seasons/5/episodes");
        expect(res.status).toBe(401);
    });

    it("returns the season's episodes", async () => {
        seasonServiceMocks.getEpisodesBySeasonId.mockResolvedValue([{id: 1, title: "Pilot"}]);

        const res = await request(app).get("/seasons/5/episodes").set("Cookie", cookie);

        expect(seasonServiceMocks.getEpisodesBySeasonId).toHaveBeenCalledWith("user-1", "5");
        expect(res.status).toBe(200);
    });
});

describe("POST /seasons/:id/episodes", () => {
    it("returns 201 when all episodes were marked watched", async () => {
        seasonServiceMocks.addAllEpisodesViewing.mockResolvedValue(undefined);

        const res = await request(app).post("/seasons/5/episodes").set("Cookie", cookie);

        expect(seasonServiceMocks.addAllEpisodesViewing).toHaveBeenCalledWith("user-1", "5");
        expect(res.status).toBe(201);
    });
});

describe("POST /seasons/:id/episodes/:episodeId", () => {
    it("returns 201 when a single episode was marked watched", async () => {
        seasonServiceMocks.addEpisodeViewing.mockResolvedValue(undefined);

        const res = await request(app).post("/seasons/5/episodes/42").set("Cookie", cookie);

        expect(seasonServiceMocks.addEpisodeViewing).toHaveBeenCalledWith("user-1", "5", "42");
        expect(res.status).toBe(201);
    });
});

describe("DELETE /seasons/:id", () => {
    it("returns 204 on success", async () => {
        seasonServiceMocks.deleteBySeasonId.mockResolvedValue(undefined);

        const res = await request(app).delete("/seasons/5").set("Cookie", cookie);

        expect(seasonServiceMocks.deleteBySeasonId).toHaveBeenCalledWith("user-1", "5");
        expect(res.status).toBe(204);
    });
});

describe("PATCH /seasons/:id", () => {
    it("returns 200 on success", async () => {
        seasonServiceMocks.updateBySeasonId.mockResolvedValue(undefined);

        const res = await request(app).patch("/seasons/5").set("Cookie", cookie).send({platform: 1, viewedAt: "2024-01-01"});

        expect(seasonServiceMocks.updateBySeasonId).toHaveBeenCalledWith("user-1", "5", 1, "2024-01-01");
        expect(res.status).toBe(200);
    });

    it("returns 404 when the season doesn't belong to the user", async () => {
        seasonServiceMocks.updateBySeasonId.mockRejectedValue(new ServiceError(404, "Saison introuvable"));

        const res = await request(app).patch("/seasons/999").set("Cookie", cookie).send({platform: 1, viewedAt: "2024-01-01"});

        expect(res.status).toBe(404);
    });
});

describe("PATCH /seasons/:id/watched-with", () => {
    it("returns 200 on success", async () => {
        seasonServiceMocks.updateWatchedWith.mockResolvedValue(undefined);

        const res = await request(app).patch("/seasons/5/watched-with").set("Cookie", cookie).send({friendIds: ["user-2"]});

        expect(seasonServiceMocks.updateWatchedWith).toHaveBeenCalledWith("user-1", "5", ["user-2"]);
        expect(res.status).toBe(200);
    });
});

describe("GET /seasons/watched-with/pending", () => {
    it("returns the current user's pending invitations", async () => {
        seasonServiceMocks.getPendingWatchedWith.mockResolvedValue([{userSeasonId: 5}]);

        const res = await request(app).get("/seasons/watched-with/pending").set("Cookie", cookie);

        expect(seasonServiceMocks.getPendingWatchedWith).toHaveBeenCalledWith("user-1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{userSeasonId: 5}]);
    });
});

describe("GET /seasons/watched-with/active", () => {
    it("returns the current user's active watch-together links", async () => {
        seasonServiceMocks.getActiveWatchedWith.mockResolvedValue([{userSeasonId: 5}]);

        const res = await request(app).get("/seasons/watched-with/active").set("Cookie", cookie);

        expect(seasonServiceMocks.getActiveWatchedWith).toHaveBeenCalledWith("user-1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{userSeasonId: 5}]);
    });
});

describe("PATCH /seasons/:id/watched-with/response", () => {
    it("returns 200 when the invitation is accepted", async () => {
        seasonServiceMocks.respondToWatchedWith.mockResolvedValue(undefined);

        const res = await request(app).patch("/seasons/5/watched-with/response").set("Cookie", cookie).send({accepted: true});

        expect(seasonServiceMocks.respondToWatchedWith).toHaveBeenCalledWith("user-1", "5", true);
        expect(res.status).toBe(200);
    });

    it("returns 409 when the friend's viewing already belongs to another group", async () => {
        seasonServiceMocks.respondToWatchedWith.mockRejectedValue(new ServiceError(409, "Conflit"));

        const res = await request(app).patch("/seasons/5/watched-with/response").set("Cookie", cookie).send({accepted: true});

        expect(res.status).toBe(409);
    });
});
