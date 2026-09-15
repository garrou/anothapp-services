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
    inviteCollaborator: vi.fn(),
    getCollaborators: vi.fn(),
    acceptCollaboratorInvite: vi.fn(),
    removeCollaborator: vi.fn(),
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

        expect(playlistServiceMocks.getPlaylists).toHaveBeenCalledWith("user-1", undefined, undefined);
        expect(res.status).toBe(200);
    });

    it("returns pending collaboration invitations when status=pending", async () => {
        playlistServiceMocks.getPlaylists.mockResolvedValue([{playlistId: "p1", playlistName: "Cosy"}]);

        const res = await request(app).get("/playlists?status=pending").set("Cookie", cookie);

        expect(playlistServiceMocks.getPlaylists).toHaveBeenCalledWith("user-1", undefined, "pending");
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{playlistId: "p1", playlistName: "Cosy"}]);
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

describe("GET /playlists/:id/collaborators", () => {
    it("returns the collaborators list", async () => {
        playlistServiceMocks.getCollaborators.mockResolvedValue([{id: "user-2", username: "bob", accepted: true}]);

        const res = await request(app).get("/playlists/p1/collaborators").set("Cookie", cookie);

        expect(playlistServiceMocks.getCollaborators).toHaveBeenCalledWith("user-1", "p1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{id: "user-2", username: "bob", accepted: true}]);
    });

    it("returns 400 for a user who is neither owner nor collaborator", async () => {
        playlistServiceMocks.getCollaborators.mockRejectedValue(new ServiceError(400, "Playlist introuvable"));

        const res = await request(app).get("/playlists/p1/collaborators").set("Cookie", cookie);

        expect(res.status).toBe(400);
    });
});

describe("POST /playlists/:id/collaborators", () => {
    it("returns 201 on success", async () => {
        playlistServiceMocks.inviteCollaborator.mockResolvedValue(undefined);

        const res = await request(app).post("/playlists/p1/collaborators").set("Cookie", cookie).send({userId: "user-2"});

        expect(playlistServiceMocks.inviteCollaborator).toHaveBeenCalledWith("user-1", "p1", "user-2");
        expect(res.status).toBe(201);
    });

    it("returns 400 when the target isn't a friend", async () => {
        playlistServiceMocks.inviteCollaborator.mockRejectedValue(new ServiceError(400, "Vous n'êtes pas en relation avec cette personne"));

        const res = await request(app).post("/playlists/p1/collaborators").set("Cookie", cookie).send({userId: "user-2"});

        expect(res.status).toBe(400);
    });
});

describe("PATCH /playlists/:id/collaborators/accept", () => {
    it("returns 200 on success", async () => {
        playlistServiceMocks.acceptCollaboratorInvite.mockResolvedValue(undefined);

        const res = await request(app).patch("/playlists/p1/collaborators/accept").set("Cookie", cookie);

        expect(playlistServiceMocks.acceptCollaboratorInvite).toHaveBeenCalledWith("user-1", "p1");
        expect(res.status).toBe(200);
    });

    it("returns 400 when there was no pending invite", async () => {
        playlistServiceMocks.acceptCollaboratorInvite.mockRejectedValue(new ServiceError(400, "Invitation introuvable"));

        const res = await request(app).patch("/playlists/p1/collaborators/accept").set("Cookie", cookie);

        expect(res.status).toBe(400);
    });
});

describe("DELETE /playlists/:id/collaborators/:userId", () => {
    it("returns 204 on success", async () => {
        playlistServiceMocks.removeCollaborator.mockResolvedValue(undefined);

        const res = await request(app).delete("/playlists/p1/collaborators/user-2").set("Cookie", cookie);

        expect(playlistServiceMocks.removeCollaborator).toHaveBeenCalledWith("user-1", "p1", "user-2");
        expect(res.status).toBe(204);
    });

    it("returns 400 when a non-owner tries to remove someone else", async () => {
        playlistServiceMocks.removeCollaborator.mockRejectedValue(new ServiceError(400, "Playlist introuvable"));

        const res = await request(app).delete("/playlists/p1/collaborators/user-2").set("Cookie", cookie);

        expect(res.status).toBe(400);
    });
});
