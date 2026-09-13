import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";
import ServiceError from "../helpers/serviceError.js";

const showServiceMocks = vi.hoisted(() => ({
    addShow: vi.fn(),
    deleteByShowId: vi.fn(),
    getShowById: vi.fn(),
    getShows: vi.fn(),
    getRecommendations: vi.fn(),
    addSeason: vi.fn(),
    getSeasonInfosByShowIdBySeason: vi.fn(),
    getSeasonWatchedTime: vi.fn(),
    updateByShowId: vi.fn(),
}));

vi.mock("../services/showService.js", () => ({
    default: vi.fn().mockImplementation(function () { return showServiceMocks; }),
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

describe("POST /shows", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).post("/shows").send({id: 10});
        expect(res.status).toBe(401);
    });

    it("returns 201 with the created show", async () => {
        showServiceMocks.addShow.mockResolvedValue({id: 10, title: "Show"});

        const res = await request(app).post("/shows").set("Cookie", cookie).send({id: 10, list: false});

        expect(showServiceMocks.addShow).toHaveBeenCalledWith("user-1", 10, false);
        expect(res.status).toBe(201);
        expect(res.body).toEqual({id: 10, title: "Show"});
    });
});

describe("GET /shows", () => {
    it("passes the query filters through to the service", async () => {
        showServiceMocks.getShows.mockResolvedValue([{id: 10, title: "Show"}]);

        const res = await request(app).get("/shows").query({title: "Show"}).set("Cookie", cookie);

        expect(showServiceMocks.getShows).toHaveBeenCalledWith("user-1", expect.objectContaining({title: "Show"}));
        expect(res.status).toBe(200);
    });
});

describe("GET /shows/recommendations", () => {
    it("returns the user's recommendations", async () => {
        showServiceMocks.getRecommendations.mockResolvedValue([{id: 20, title: "Recommended"}]);

        const res = await request(app).get("/shows/recommendations").set("Cookie", cookie);

        expect(showServiceMocks.getRecommendations).toHaveBeenCalledWith("user-1");
        expect(res.status).toBe(200);
    });
});

describe("GET /shows/:id", () => {
    it("returns a single show", async () => {
        showServiceMocks.getShowById.mockResolvedValue({id: 10, title: "Show"});

        const res = await request(app).get("/shows/10").set("Cookie", cookie);

        expect(showServiceMocks.getShowById).toHaveBeenCalledWith("user-1", "10");
        expect(res.status).toBe(200);
    });

    it("returns 404 when the show is not in the user's list", async () => {
        showServiceMocks.getShowById.mockRejectedValue(new ServiceError(404, "Série introuvable"));

        const res = await request(app).get("/shows/999").set("Cookie", cookie);

        expect(res.status).toBe(404);
    });
});

describe("DELETE /shows/:id", () => {
    it("returns 204 on success", async () => {
        showServiceMocks.deleteByShowId.mockResolvedValue(undefined);

        const res = await request(app).delete("/shows/10").query({list: "true"}).set("Cookie", cookie);

        expect(showServiceMocks.deleteByShowId).toHaveBeenCalledWith("user-1", "10", "true");
        expect(res.status).toBe(204);
    });
});

describe("PATCH /shows/:id", () => {
    it("returns 200 with the new value", async () => {
        showServiceMocks.updateByShowId.mockResolvedValue(true);

        const res = await request(app).patch("/shows/10").set("Cookie", cookie).send({favorite: true});

        expect(showServiceMocks.updateByShowId).toHaveBeenCalledWith("user-1", "10", {favorite: true});
        expect(res.status).toBe(200);
        expect(res.body).toEqual({value: true});
    });
});

describe("POST /shows/:id/seasons", () => {
    it("returns 201 on success", async () => {
        showServiceMocks.addSeason.mockResolvedValue(undefined);

        const res = await request(app).post("/shows/10/seasons").set("Cookie", cookie).send({id: 10, num: 1});

        expect(showServiceMocks.addSeason).toHaveBeenCalledWith("user-1", 10, 1);
        expect(res.status).toBe(201);
    });
});

describe("GET /shows/:id/seasons/:num", () => {
    it("returns the season infos", async () => {
        showServiceMocks.getSeasonInfosByShowIdBySeason.mockResolvedValue([{id: 1}]);

        const res = await request(app).get("/shows/10/seasons/1").set("Cookie", cookie);

        expect(showServiceMocks.getSeasonInfosByShowIdBySeason).toHaveBeenCalledWith("user-1", "10", "1");
        expect(res.status).toBe(200);
    });
});

describe("GET /shows/:id/seasons/:num/time", () => {
    it("returns the watched time", async () => {
        showServiceMocks.getSeasonWatchedTime.mockResolvedValue(120);

        const res = await request(app).get("/shows/10/seasons/1/time").set("Cookie", cookie);

        expect(showServiceMocks.getSeasonWatchedTime).toHaveBeenCalledWith("user-1", "10", "1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({time: 120});
    });
});
