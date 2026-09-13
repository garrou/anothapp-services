import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";
import ServiceError from "../helpers/serviceError.js";

const actorServiceMocks = vi.hoisted(() => ({
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    getFavorites: vi.fn(),
}));

vi.mock("../services/actorService.js", () => ({
    default: vi.fn().mockImplementation(function () { return actorServiceMocks; }),
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

describe("GET /actors/favorites", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/actors/favorites");
        expect(res.status).toBe(401);
    });

    it("returns the user's favorite actors", async () => {
        actorServiceMocks.getFavorites.mockResolvedValue([{id: 1, name: "Actor"}]);

        const res = await request(app).get("/actors/favorites").set("Cookie", cookie);

        expect(actorServiceMocks.getFavorites).toHaveBeenCalledWith("user-1", undefined);
        expect(res.status).toBe(200);
    });
});

describe("POST /actors/:id/favorite", () => {
    it("returns 200 with the actor", async () => {
        actorServiceMocks.addFavorite.mockResolvedValue({id: 1, name: "Actor"});

        const res = await request(app).post("/actors/1/favorite").set("Cookie", cookie);

        expect(actorServiceMocks.addFavorite).toHaveBeenCalledWith("user-1", 1);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({id: 1, name: "Actor"});
    });
});

describe("DELETE /actors/:id/favorite", () => {
    it("returns 204 on success", async () => {
        actorServiceMocks.removeFavorite.mockResolvedValue(undefined);

        const res = await request(app).delete("/actors/1/favorite").set("Cookie", cookie);

        expect(actorServiceMocks.removeFavorite).toHaveBeenCalledWith("user-1", 1);
        expect(res.status).toBe(204);
    });

    it("returns 404 when the actor isn't a favorite", async () => {
        actorServiceMocks.removeFavorite.mockRejectedValue(new ServiceError(404, "Acteur introuvable"));

        const res = await request(app).delete("/actors/999/favorite").set("Cookie", cookie);

        expect(res.status).toBe(404);
    });
});
