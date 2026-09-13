import {describe, it, expect, vi, beforeAll, beforeEach} from "vitest";
import request from "supertest";
import SecurityHelper from "../helpers/security.js";
import ServiceError from "../helpers/serviceError.js";

const playlistServiceMocks = vi.hoisted(() => ({
    getPlaylists: vi.fn(),
    getPlaylistById: vi.fn(),
    createPlaylist: vi.fn(),
    updatePlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    addShowToPlaylist: vi.fn(),
    removeShowFromPlaylist: vi.fn(),
}));

vi.mock("../services/playlistService.js", () => ({
    default: vi.fn().mockImplementation(function () { return playlistServiceMocks; }),
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

describe("GET /playlists", () => {
    it("returns 401 without an access cookie", async () => {
        const res = await request(app).get("/playlists");
        expect(res.status).toBe(401);
    });

    it("returns the user's playlists", async () => {
        playlistServiceMocks.getPlaylists.mockResolvedValue([{id: "p1", name: "My playlist"}]);

        const res = await request(app).get("/playlists").set("Cookie", cookie);

        expect(playlistServiceMocks.getPlaylists).toHaveBeenCalledWith("user-1", undefined);
        expect(res.status).toBe(200);
    });
});

describe("POST /playlists", () => {
    it("returns 201 with the created playlist", async () => {
        playlistServiceMocks.createPlaylist.mockResolvedValue({id: "p1", name: "My playlist"});

        const res = await request(app).post("/playlists").set("Cookie", cookie).send({name: "My playlist", visible: true});

        expect(playlistServiceMocks.createPlaylist).toHaveBeenCalledWith("user-1", "My playlist", true);
        expect(res.status).toBe(201);
    });
});

describe("GET /playlists/:id", () => {
    it("returns a single playlist", async () => {
        playlistServiceMocks.getPlaylistById.mockResolvedValue({id: "p1", name: "My playlist"});

        const res = await request(app).get("/playlists/p1").set("Cookie", cookie);

        expect(playlistServiceMocks.getPlaylistById).toHaveBeenCalledWith("user-1", "p1");
        expect(res.status).toBe(200);
    });

    it("returns 404 when the playlist doesn't exist", async () => {
        playlistServiceMocks.getPlaylistById.mockRejectedValue(new ServiceError(404, "Playlist introuvable"));

        const res = await request(app).get("/playlists/unknown").set("Cookie", cookie);

        expect(res.status).toBe(404);
    });
});

describe("PATCH /playlists/:id", () => {
    it("returns 204 on success", async () => {
        playlistServiceMocks.updatePlaylist.mockResolvedValue(undefined);

        const res = await request(app).patch("/playlists/p1").set("Cookie", cookie).send({name: "New name", visible: false});

        expect(playlistServiceMocks.updatePlaylist).toHaveBeenCalledWith("user-1", "p1", {name: "New name", visible: false});
        expect(res.status).toBe(204);
    });
});

describe("DELETE /playlists/:id", () => {
    it("returns 204 on success", async () => {
        playlistServiceMocks.deletePlaylist.mockResolvedValue(undefined);

        const res = await request(app).delete("/playlists/p1").set("Cookie", cookie);

        expect(playlistServiceMocks.deletePlaylist).toHaveBeenCalledWith("user-1", "p1");
        expect(res.status).toBe(204);
    });
});

describe("POST /playlists/:id/shows", () => {
    it("returns 201 on success", async () => {
        playlistServiceMocks.addShowToPlaylist.mockResolvedValue(undefined);

        const res = await request(app).post("/playlists/p1/shows").set("Cookie", cookie).send({showId: 10});

        expect(playlistServiceMocks.addShowToPlaylist).toHaveBeenCalledWith("user-1", "p1", 10);
        expect(res.status).toBe(201);
    });
});

describe("DELETE /playlists/:id/shows/:showId", () => {
    it("returns 204 on success", async () => {
        playlistServiceMocks.removeShowFromPlaylist.mockResolvedValue(undefined);

        const res = await request(app).delete("/playlists/p1/shows/10").set("Cookie", cookie);

        expect(playlistServiceMocks.removeShowFromPlaylist).toHaveBeenCalledWith("user-1", "p1", 10);
        expect(res.status).toBe(204);
    });
});
