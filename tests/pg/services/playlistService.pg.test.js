import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import PlaylistService from "../../../services/playlistService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertPlaylist, insertShow } from "../fixtures.js";

describe("PlaylistService (real Postgres)", () => {
    /** @type {PlaylistService} */
    let service;

    const makeFriends = async (userId, otherId) => {
        await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, otherId]);
    };

    beforeEach(async () => {
        await resetDb();
        service = new PlaylistService();
    });

    describe("createPlaylist", () => {
        it("creates a playlist", async () => {
            const userId = await insertUser();

            const playlist = await service.createPlaylist(userId, "  My Playlist  ", true);

            expect(playlist.name).toBe("My Playlist");
            expect(playlist.visible).toBe(true);
        });

        it("rejects an empty name", async () => {
            const userId = await insertUser();

            await expect(service.createPlaylist(userId, "   ")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("getPlaylists", () => {
        it("returns owned and collaborating playlists tagged with their role, newest first", async () => {
            const userId = await insertUser();
            const owned = await insertPlaylist(userId, { name: "Owned" });
            const otherOwnerId = await insertUser();
            const collaborating = await insertPlaylist(otherOwnerId, { name: "Collaborating" });
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id, accepted) VALUES ($1, $2, TRUE)`, [collaborating, userId]);

            const result = await service.getPlaylists(userId);

            const owner = result.find((p) => p.id === owned);
            const collaborator = result.find((p) => p.id === collaborating);
            expect(owner.role).toBe("owner");
            expect(collaborator.role).toBe("collaborator");
        });

        it("returns a friend's visible playlists when friendId is given", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await makeFriends(userId, friendId);
            await insertPlaylist(friendId, { name: "Public", visible: true });
            await insertPlaylist(friendId, { name: "Private", visible: false });

            const result = await service.getPlaylists(userId, friendId);

            expect(result.map((p) => p.name)).toEqual(["Public"]);
        });

        it("rejects a friendId for someone who isn't a friend", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();

            await expect(service.getPlaylists(userId, strangerId)).rejects.toMatchObject({ status: 400 });
        });

        it("returns pending collaboration invites for status=pending", async () => {
            const userId = await insertUser();
            const ownerId = await insertUser();
            const playlistId = await insertPlaylist(ownerId, { name: "Invited" });
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id) VALUES ($1, $2)`, [playlistId, userId]);

            const result = await service.getPlaylists(userId, undefined, "pending");

            expect(result.map((i) => i.playlistName)).toEqual(["Invited"]);
        });
    });

    describe("getPlaylistById", () => {
        it("owner sees role=owner", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId);

            const { playlist } = await service.getPlaylistById(userId, playlistId);

            expect(playlist.role).toBe("owner");
        });

        it("an accepted collaborator sees role=collaborator, even when the playlist isn't visible", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId, { visible: false });
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id, accepted) VALUES ($1, $2, TRUE)`, [playlistId, collaboratorId]);

            const { playlist } = await service.getPlaylistById(collaboratorId, playlistId);

            expect(playlist.role).toBe("collaborator");
        });

        it("someone with a pending invite sees role=pending", async () => {
            const ownerId = await insertUser();
            const invitedId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id) VALUES ($1, $2)`, [playlistId, invitedId]);

            const { playlist } = await service.getPlaylistById(invitedId, playlistId);

            expect(playlist.role).toBe("pending");
        });

        it("a friend sees role=viewer when the playlist is visible", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            await makeFriends(ownerId, friendId);
            const playlistId = await insertPlaylist(ownerId, { visible: true });

            const { playlist } = await service.getPlaylistById(friendId, playlistId);

            expect(playlist.role).toBe("viewer");
        });

        it("rejects a stranger", async () => {
            const ownerId = await insertUser();
            const strangerId = await insertUser();
            const playlistId = await insertPlaylist(ownerId, { visible: true });

            await expect(service.getPlaylistById(strangerId, playlistId)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updatePlaylist / deletePlaylist", () => {
        it("only the owner can rename", async () => {
            const userId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(userId, { name: "Old" });
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id, accepted) VALUES ($1, $2, TRUE)`, [playlistId, collaboratorId]);

            await service.updatePlaylist(userId, playlistId, { name: "New" });
            await expect(service.updatePlaylist(collaboratorId, playlistId, { name: "Hijacked" }))
                .rejects.toMatchObject({ status: 400 });

            const { playlist } = await service.getPlaylistById(userId, playlistId);
            expect(playlist.name).toBe("New");
        });

        it("only the owner can delete", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();
            const playlistId = await insertPlaylist(userId);

            await expect(service.deletePlaylist(strangerId, playlistId)).rejects.toMatchObject({ status: 400 });
            await service.deletePlaylist(userId, playlistId);

            const res = await db.query(`SELECT * FROM playlists WHERE id = $1`, [playlistId]);
            expect(res.rowCount).toBe(0);
        });
    });

    describe("addShowToPlaylist / removeShowFromPlaylist", () => {
        it("the owner can add and remove a show", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId);
            const showId = await insertShow();

            await service.addShowToPlaylist(userId, playlistId, showId);
            const { shows } = await service.getPlaylistById(userId, playlistId);
            expect(shows.map((s) => s.id)).toEqual([showId]);

            await service.removeShowFromPlaylist(userId, playlistId, showId);
            const after = await service.getPlaylistById(userId, playlistId);
            expect(after.shows).toEqual([]);
        });

        it("an accepted collaborator can add a show, but a pending invitee cannot", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const pendingId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);
            const showId = await insertShow();
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id, accepted) VALUES ($1, $2, TRUE)`, [playlistId, collaboratorId]);
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id) VALUES ($1, $2)`, [playlistId, pendingId]);

            await service.addShowToPlaylist(collaboratorId, playlistId, showId);
            await expect(service.addShowToPlaylist(pendingId, playlistId, showId + 1))
                .rejects.toMatchObject({ status: 400 });
        });

        it("rejects adding a show already in the playlist", async () => {
            const userId = await insertUser();
            const playlistId = await insertPlaylist(userId);
            const showId = await insertShow();
            await service.addShowToPlaylist(userId, playlistId, showId);

            await expect(service.addShowToPlaylist(userId, playlistId, showId))
                .rejects.toMatchObject({ status: 400 });
        });
    });

    describe("inviteCollaborator / acceptCollaboratorInvite / removeCollaborator / getCollaborators", () => {
        it("owner invites a friend, who accepts and then appears as an accepted collaborator", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            await makeFriends(ownerId, friendId);
            const playlistId = await insertPlaylist(ownerId);

            await service.inviteCollaborator(ownerId, playlistId, friendId);
            await service.acceptCollaboratorInvite(friendId, playlistId);

            const collaborators = await service.getCollaborators(ownerId, playlistId);
            expect(collaborators).toEqual([expect.objectContaining({ id: friendId, accepted: true })]);
        });

        it("rejects inviting someone who isn't a friend", async () => {
            const ownerId = await insertUser();
            const strangerId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);

            await expect(service.inviteCollaborator(ownerId, playlistId, strangerId))
                .rejects.toMatchObject({ status: 400 });
        });

        it("a non-owner cannot invite", async () => {
            const ownerId = await insertUser();
            const someoneId = await insertUser();
            const friendId = await insertUser();
            await makeFriends(someoneId, friendId);
            const playlistId = await insertPlaylist(ownerId);

            await expect(service.inviteCollaborator(someoneId, playlistId, friendId))
                .rejects.toMatchObject({ status: 400 });
        });

        it("the invitee can decline their own pending invite", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            await makeFriends(ownerId, friendId);
            const playlistId = await insertPlaylist(ownerId);
            await service.inviteCollaborator(ownerId, playlistId, friendId);

            await service.removeCollaborator(friendId, playlistId, friendId);

            const collaborators = await service.getCollaborators(ownerId, playlistId);
            expect(collaborators).toEqual([]);
        });

        it("the owner can remove an accepted collaborator", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            await makeFriends(ownerId, friendId);
            const playlistId = await insertPlaylist(ownerId);
            await service.inviteCollaborator(ownerId, playlistId, friendId);
            await service.acceptCollaboratorInvite(friendId, playlistId);

            await service.removeCollaborator(ownerId, playlistId, friendId);

            const collaborators = await service.getCollaborators(ownerId, playlistId);
            expect(collaborators).toEqual([]);
        });

        it("a non-owner cannot remove someone else", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            const strangerId = await insertUser();
            await makeFriends(ownerId, friendId);
            const playlistId = await insertPlaylist(ownerId);
            await service.inviteCollaborator(ownerId, playlistId, friendId);
            await service.acceptCollaboratorInvite(friendId, playlistId);

            await expect(service.removeCollaborator(strangerId, playlistId, friendId))
                .rejects.toMatchObject({ status: 400 });
        });
    });
});
