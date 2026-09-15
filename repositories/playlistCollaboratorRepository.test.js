import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import PlaylistCollaboratorRepository from "./playlistCollaboratorRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("PlaylistCollaboratorRepository", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistCollaboratorRepository();
    });

    describe("invite", () => {
        it("returns true when a row was inserted", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.invite("p1", "user-2");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO playlists_collaborators"), ["p1", "user-2"]);
            expect(result).toBe(true);
        });
    });

    describe("accept", () => {
        it("returns true when a row was updated", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.accept("p1", "user-2");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE playlists_collaborators"), ["p1", "user-2"]);
            expect(result).toBe(true);
        });

        it("returns false when no matching invite existed", async () => {
            db.query.mockResolvedValue({rowCount: 0});

            const result = await repo.accept("p1", "user-2");

            expect(result).toBe(false);
        });
    });

    describe("remove", () => {
        it("returns true when a row was deleted", async () => {
            db.query.mockResolvedValue({rowCount: 1});

            const result = await repo.remove("p1", "user-2");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM playlists_collaborators"), ["p1", "user-2"]);
            expect(result).toBe(true);
        });

        it("returns false when no matching row existed", async () => {
            db.query.mockResolvedValue({rowCount: 0});

            const result = await repo.remove("p1", "user-2");

            expect(result).toBe(false);
        });
    });

    describe("checkExists", () => {
        it("returns true when a pending or accepted invite exists", async () => {
            db.query.mockResolvedValue({rows: [{total: "1"}]});

            const result = await repo.checkExists("p1", "user-2");

            expect(result).toBe(true);
        });

        it("returns false when no invite exists", async () => {
            db.query.mockResolvedValue({rows: [{total: "0"}]});

            const result = await repo.checkExists("p1", "user-2");

            expect(result).toBe(false);
        });
    });

    describe("checkIsAcceptedCollaborator", () => {
        it("returns true when the user is an accepted collaborator", async () => {
            db.query.mockResolvedValue({rows: [{total: "1"}]});

            const result = await repo.checkIsAcceptedCollaborator("p1", "user-2");

            expect(result).toBe(true);
        });

        it("returns false when the user is not an accepted collaborator", async () => {
            db.query.mockResolvedValue({rows: [{total: "0"}]});

            const result = await repo.checkIsAcceptedCollaborator("p1", "user-2");

            expect(result).toBe(false);
        });
    });

    describe("getByPlaylistId", () => {
        it("maps rows to PlaylistCollaborator instances", async () => {
            db.query.mockResolvedValue({
                rows: [{id: "user-2", username: "bob", picture: null, accepted: true, invited_at: "2024-01-01"}],
            });

            const result = await repo.getByPlaylistId("p1");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["p1"]);
            expect(result).toEqual([{id: "user-2", username: "bob", picture: null, accepted: true, invitedAt: "2024-01-01"}]);
        });

        it("returns an empty array when there are no collaborators", async () => {
            db.query.mockResolvedValue({rows: []});

            const result = await repo.getByPlaylistId("p1");

            expect(result).toEqual([]);
        });
    });

    describe("getCountByUserId", () => {
        it("returns the number of playlists this user accepted a collaborator invite on", async () => {
            db.query.mockResolvedValue({rows: [{total: "4"}]});

            const result = await repo.getCountByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM playlists_collaborators"), ["user-1"]);
            expect(result).toBe(4);
        });

        it("returns 0 when the user isn't collaborating on anything", async () => {
            db.query.mockResolvedValue({rows: [{total: "0"}]});

            const result = await repo.getCountByUserId("user-1");

            expect(result).toBe(0);
        });
    });

    describe("getOne", () => {
        it("returns the collaborator's accepted state when found", async () => {
            db.query.mockResolvedValue({rowCount: 1, rows: [{accepted: false}]});

            const result = await repo.getOne("p1", "user-2");

            expect(db.query).toHaveBeenCalledWith(expect.any(String), ["p1", "user-2"]);
            expect(result).toEqual({accepted: false});
        });

        it("returns null when there is no such collaborator", async () => {
            db.query.mockResolvedValue({rowCount: 0, rows: []});

            const result = await repo.getOne("p1", "user-2");

            expect(result).toBeNull();
        });
    });

    describe("removeAllBetween", () => {
        it("deletes collaborator rows between the two users in either direction", async () => {
            db.query.mockResolvedValue({rowCount: 2});

            const result = await repo.removeAllBetween("user-1", "user-2");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM playlists_collaborators"), ["user-1", "user-2"]);
            expect(result).toBe(2);
        });

        it("returns 0 when there was no collaborator relationship between them", async () => {
            db.query.mockResolvedValue({rowCount: 0});

            const result = await repo.removeAllBetween("user-1", "user-2");

            expect(result).toBe(0);
        });
    });

    describe("getPendingByUserId", () => {
        it("returns every playlist invitation still awaiting this user's response", async () => {
            db.query.mockResolvedValue({
                rows: [{
                    playlist_id: "p1", playlist_name: "Cosy", invited_at: "2026-01-01",
                    owner_id: "user-2", owner_username: "bob", owner_picture: null,
                }],
            });

            const result = await repo.getPendingByUserId("user-1");

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining("accepted = FALSE"), ["user-1"]);
            expect(result).toEqual([expect.objectContaining({
                playlistId: "p1", playlistName: "Cosy", ownerUsername: "bob",
            })]);
        });

        it("returns an empty array when there are no pending invitations", async () => {
            db.query.mockResolvedValue({rows: []});

            const result = await repo.getPendingByUserId("user-1");

            expect(result).toEqual([]);
        });
    });
});
