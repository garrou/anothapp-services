import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";
import ServiceError from "../helpers/serviceError.js";

const searchServiceMocks = vi.hoisted(() => ({
    getImages: vi.fn(),
    getShows: vi.fn(),
    getByShowId: vi.fn(),
    getSeasonsByShowId: vi.fn(),
    getEpisodesByShowIdBySeason: vi.fn(),
    getCharactersByShowId: vi.fn(),
    getSimilarsByShowId: vi.fn(),
    getImagesByShowId: vi.fn(),
    getKinds: vi.fn(),
    getPlatforms: vi.fn(),
    getNotes: vi.fn(),
    getPersonById: vi.fn(),
}));

vi.mock("../services/searchService.js", () => ({
    default: vi.fn().mockImplementation(function () { return searchServiceMocks; }),
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

// Every route under /search is cached by URL (middlewares/cache.js, covered by its own unit
// test). Each request below therefore uses a distinct originalUrl (its own path, or a unique
// query string) so it can't accidentally hit a response cached by a previous test in this file.

describe("GET /search/images", () => {
    it("is reachable without an access cookie (whitelisted)", async () => {
        searchServiceMocks.getImages.mockResolvedValue(["a.png", "b.png"]);

        const res = await request(app).get("/search/images").query({limit: "2"});

        expect(searchServiceMocks.getImages).toHaveBeenCalledWith("2");
        expect(res.status).toBe(200);
        expect(res.body).toEqual(["a.png", "b.png"]);
    });
});

describe("GET /search/shows", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/search/shows");
        expect(res.status).toBe(401);
    });

    it("passes the query filters through to the service", async () => {
        searchServiceMocks.getShows.mockResolvedValue([{id: 10, title: "Show"}]);

        const res = await request(app).get("/search/shows").query({title: "Show"}).set("Cookie", cookie);

        expect(searchServiceMocks.getShows).toHaveBeenCalledWith("Show", undefined, undefined, undefined, undefined);
        expect(res.status).toBe(200);
    });
});

describe("GET /search/shows/:showId", () => {
    it("returns the show", async () => {
        searchServiceMocks.getByShowId.mockResolvedValue({id: 10, title: "Show"});

        const res = await request(app).get("/search/shows/10").set("Cookie", cookie);

        expect(searchServiceMocks.getByShowId).toHaveBeenCalledWith("10");
        expect(res.status).toBe(200);
    });

    it("returns 400 when the service rejects the id", async () => {
        searchServiceMocks.getByShowId.mockRejectedValue(new ServiceError(400, "Requête invalide"));

        const res = await request(app).get("/search/shows/invalid").set("Cookie", cookie);

        expect(res.status).toBe(400);
    });
});

describe("GET /search/shows/:showId/seasons", () => {
    it("returns the show's seasons", async () => {
        searchServiceMocks.getSeasonsByShowId.mockResolvedValue([{number: 1}]);

        const res = await request(app).get("/search/shows/10/seasons").set("Cookie", cookie);

        expect(searchServiceMocks.getSeasonsByShowId).toHaveBeenCalledWith("10");
        expect(res.status).toBe(200);
    });
});

describe("GET /search/shows/:showId/seasons/:num/episodes", () => {
    it("returns the season's episodes", async () => {
        searchServiceMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{id: 1, title: "Pilot"}]);

        const res = await request(app).get("/search/shows/10/seasons/1/episodes").set("Cookie", cookie);

        expect(searchServiceMocks.getEpisodesByShowIdBySeason).toHaveBeenCalledWith("10", "1");
        expect(res.status).toBe(200);
    });
});

describe("GET /search/shows/:showId/characters", () => {
    it("returns the show's characters", async () => {
        searchServiceMocks.getCharactersByShowId.mockResolvedValue([{id: 1, name: "Character"}]);

        const res = await request(app).get("/search/shows/10/characters").set("Cookie", cookie);

        expect(searchServiceMocks.getCharactersByShowId).toHaveBeenCalledWith("10");
        expect(res.status).toBe(200);
    });
});

describe("GET /search/shows/:showId/similars", () => {
    it("returns similar shows", async () => {
        searchServiceMocks.getSimilarsByShowId.mockResolvedValue([{id: 20, title: "Other"}]);

        const res = await request(app).get("/search/shows/10/similars").set("Cookie", cookie);

        expect(searchServiceMocks.getSimilarsByShowId).toHaveBeenCalledWith("10");
        expect(res.status).toBe(200);
    });
});

describe("GET /search/shows/:showId/images", () => {
    it("returns the show's images", async () => {
        searchServiceMocks.getImagesByShowId.mockResolvedValue(["a.png"]);

        const res = await request(app).get("/search/shows/10/images").set("Cookie", cookie);

        expect(searchServiceMocks.getImagesByShowId).toHaveBeenCalledWith("10");
        expect(res.status).toBe(200);
    });
});

describe("GET /search/kinds", () => {
    it("returns the kinds list", async () => {
        searchServiceMocks.getKinds.mockResolvedValue([{value: "Drama", name: "Drame"}]);

        const res = await request(app).get("/search/kinds").set("Cookie", cookie);

        expect(searchServiceMocks.getKinds).toHaveBeenCalled();
        expect(res.status).toBe(200);
    });
});

describe("GET /search/platforms", () => {
    it("returns the platforms list", async () => {
        searchServiceMocks.getPlatforms.mockResolvedValue([{id: 1, name: "Netflix"}]);

        const res = await request(app).get("/search/platforms").set("Cookie", cookie);

        expect(searchServiceMocks.getPlatforms).toHaveBeenCalled();
        expect(res.status).toBe(200);
    });
});

describe("GET /search/notes", () => {
    it("returns the notes list", async () => {
        searchServiceMocks.getNotes.mockResolvedValue([{id: 1, name: "Excellent"}]);

        const res = await request(app).get("/search/notes").set("Cookie", cookie);

        expect(searchServiceMocks.getNotes).toHaveBeenCalled();
        expect(res.status).toBe(200);
    });
});

describe("GET /search/persons/:personId", () => {
    it("returns the person", async () => {
        searchServiceMocks.getPersonById.mockResolvedValue({id: 5, name: "Actor"});

        const res = await request(app).get("/search/persons/5").set("Cookie", cookie);

        expect(searchServiceMocks.getPersonById).toHaveBeenCalledWith("5");
        expect(res.status).toBe(200);
    });
});
