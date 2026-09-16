import { describe, it, expect, beforeEach } from "vitest";
import db from "../config/db.js";
import PlaylistRepository from "./playlistRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import { insertUser, insertShow, insertPlaylist } from "../tests/pg/fixtures.js";

describe("PlaylistRepository (real Postgres)", () => {
    /** @type {PlaylistRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new PlaylistRepository();
    });

    describe("create / getById", () => {
        it("creates a playlist and retrieves it", async () => {
            const userId = await insertUser();

            const created = await repo.create(userId, "My Playlist", true);

            expect(created.name).toBe("My Playlist");
            expect(created.visible).toBe(true);
            const found = await repo.getById(created.id);
            expect(found.id).toBe(created.id);
        });

        it("returns null when the playlist does not exist", async () => {
            const result = await repo.getById("00000000-0000-0000-0000-000000000000");

            expect(result).toBeNull();
        });
    });

    describe("getCountByUserId", () => {
        it("counts only the requesting user's playlists", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            await insertPlaylist(userId);
            await insertPlaylist(userId);
            await insertPlaylist(otherUserId);

            const result = await repo.getCountByUserId(userId);

            expect(result).toBe(2);
        });
    });

    describe("getByUserId", () => {
        it("returns the user's playlists with show count and cover posters, newest first", async () => {
            const userId = await insertUser();
            const older = await insertPlaylist(userId, { name: "Older" });
            await new Promise((resolve) => setTimeout(resolve, 10));
            const newer = await insertPlaylist(userId, { name: "Newer" });
            const showId = await insertShow({ poster: "poster.jpg" });
            await repo.addShow(older, showId);

            const result = await repo.getByUserId(userId);

            expect(result.map((p) => p.id)).toEqual([newer, older]);
            const olderPlaylist = result.find((p) => p.id === older);
            expect(olderPlaylist.showsCount).toBe(1);
            expect(olderPlaylist.posters).toEqual(["poster.jpg"]);
        });

        it("does not include another user's playlists", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            await insertPlaylist(otherUserId);

            const result = await repo.getByUserId(userId);

            expect(result).toEqual([]);
        });
    });

    describe("getVisibleByUserId", () => {
        it("only returns the user's visible playlists", async () => {
            const userId = await insertUser();
            await insertPlaylist(userId, { name: "Public", visible: true });
            await insertPlaylist(userId, { name: "Private", visible: false });

            const result = await repo.getVisibleByUserId(userId);

            expect(result.map((p) => p.name)).toEqual(["Public"]);
        });
    });

    describe("getCollaboratingByUserId", () => {
        it("returns playlists the user is an accepted collaborator on", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId, { name: "Shared" });
            await db.query(`
                INSERT INTO playlists_collaborators (playlist_id, user_id, accepted) VALUES ($1, $2, TRUE)
            `, [playlistId, collaboratorId]);

            const result = await repo.getCollaboratingByUserId(collaboratorId);

            expect(result.map((p) => p.name)).toEqual(["Shared"]);
        });

        it("excludes playlists with a pending (not yet accepted) invite", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);
            await db.query(`
                INSERT INTO playlists_collaborators (playlist_id, user_id, accepted) VALUES ($1, $2, FALSE)
            `, [playlistId, collaboratorId]);

            const result = await repo.getCollaboratingByUserId(collaboratorId);

            expect(result).toEqual([]);
        });
    });

    describe("update", () => {
        it("updates the name and visibility", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId, { name: "Old", visible: false });

            const result = await repo.update(playlistId, { name: "New", visible: true });

            expect(result).toBe(true);
            const found = await repo.getById(playlistId);
            expect(found.name).toBe("New");
            expect(found.visible).toBe(true);
        });

        it("keeps existing fields when a field is omitted", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId, { name: "Keep", visible: true });

            await repo.update(playlistId, { name: undefined, visible: undefined });

            const found = await repo.getById(playlistId);
            expect(found.name).toBe("Keep");
            expect(found.visible).toBe(true);
        });
    });

    describe("delete", () => {
        it("deletes the playlist", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId);

            const result = await repo.delete(playlistId);

            expect(result).toBe(true);
            expect(await repo.getById(playlistId)).toBeNull();
        });
    });

    describe("addShow / removeShow / getShowsByPlaylistId", () => {
        it("adds a show and lists it", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId);
            const showId = await insertShow({ title: "Dark" });

            const result = await repo.addShow(playlistId, showId);

            expect(result).toBe(true);
            const shows = await repo.getShowsByPlaylistId(playlistId);
            expect(shows.map((s) => s.title)).toEqual(["Dark"]);
        });

        it("returns false when the show is already in the playlist", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId);
            const showId = await insertShow();
            await repo.addShow(playlistId, showId);

            const result = await repo.addShow(playlistId, showId);

            expect(result).toBe(false);
        });

        it("removes a show from the playlist", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId);
            const showId = await insertShow();
            await repo.addShow(playlistId, showId);

            const result = await repo.removeShow(playlistId, showId);

            expect(result).toBe(true);
            const shows = await repo.getShowsByPlaylistId(playlistId);
            expect(shows).toEqual([]);
        });
    });
});
