import { describe, it, expect, beforeEach } from "vitest";
import PlaylistCollaboratorRepository from "./playlistCollaboratorRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import { insertUser, insertPlaylist } from "../tests/pg/fixtures.js";

describe("PlaylistCollaboratorRepository (real Postgres)", () => {
    /** @type {PlaylistCollaboratorRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new PlaylistCollaboratorRepository();
    });

    describe("invite / checkExists / getOne", () => {
        it("creates a pending invite", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);

            const result = await repo.invite(playlistId, collaboratorId);

            expect(result).toBe(true);
            expect(await repo.checkExists(playlistId, collaboratorId)).toBe(true);
            expect(await repo.getOne(playlistId, collaboratorId)).toEqual({ accepted: false });
        });

        it("getOne returns null when there is no invite", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);

            const result = await repo.getOne(playlistId, collaboratorId);

            expect(result).toBeNull();
        });
    });

    describe("accept", () => {
        it("accepts a pending invite", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);
            await repo.invite(playlistId, collaboratorId);

            const result = await repo.accept(playlistId, collaboratorId);

            expect(result).toBe(true);
            expect(await repo.checkIsAcceptedCollaborator(playlistId, collaboratorId)).toBe(true);
        });

        it("returns false when there is no invite to accept", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);

            const result = await repo.accept(playlistId, collaboratorId);

            expect(result).toBe(false);
        });
    });

    describe("remove", () => {
        it("removes a collaborator (declines the invite or a departure/kick)", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);
            await repo.invite(playlistId, collaboratorId);

            const result = await repo.remove(playlistId, collaboratorId);

            expect(result).toBe(true);
            expect(await repo.checkExists(playlistId, collaboratorId)).toBe(false);
        });

        it("returns false when there is nothing to remove", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);

            const result = await repo.remove(playlistId, collaboratorId);

            expect(result).toBe(false);
        });
    });

    describe("getByPlaylistId", () => {
        it("lists every collaborator (pending and accepted), oldest invite first", async () => {
            const ownerId = await insertUser();
            const first = await insertUser({ username: "first_collab" });
            const second = await insertUser({ username: "second_collab" });
            const playlistId = await insertPlaylist(ownerId);
            await repo.invite(playlistId, first);
            await new Promise((resolve) => setTimeout(resolve, 10));
            await repo.invite(playlistId, second);
            await repo.accept(playlistId, first);

            const result = await repo.getByPlaylistId(playlistId);

            expect(result.map((c) => c.username)).toEqual(["first_collab", "second_collab"]);
            expect(result[0].accepted).toBe(true);
            expect(result[1].accepted).toBe(false);
        });
    });

    describe("getCountByUserId", () => {
        it("counts only accepted collaborations", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const acceptedPlaylist = await insertPlaylist(ownerId);
            const pendingPlaylist = await insertPlaylist(ownerId);
            await repo.invite(acceptedPlaylist, collaboratorId);
            await repo.accept(acceptedPlaylist, collaboratorId);
            await repo.invite(pendingPlaylist, collaboratorId);

            const result = await repo.getCountByUserId(collaboratorId);

            expect(result).toBe(1);
        });
    });

    describe("removeAllBetween", () => {
        it("removes collaborator rows in both ownership directions between two users", async () => {
            const userA = await insertUser();
            const userB = await insertUser();
            const playlistOwnedByA = await insertPlaylist(userA);
            const playlistOwnedByB = await insertPlaylist(userB);
            await repo.invite(playlistOwnedByA, userB);
            await repo.invite(playlistOwnedByB, userA);
            const unrelatedUser = await insertUser();
            const playlistOwnedByUnrelated = await insertPlaylist(unrelatedUser);
            await repo.invite(playlistOwnedByUnrelated, userA);

            const result = await repo.removeAllBetween(userA, userB);

            expect(result).toBe(2);
            expect(await repo.checkExists(playlistOwnedByA, userB)).toBe(false);
            expect(await repo.checkExists(playlistOwnedByB, userA)).toBe(false);
            expect(await repo.checkExists(playlistOwnedByUnrelated, userA)).toBe(true);
        });
    });

    describe("getPendingByUserId", () => {
        it("returns the user's pending invites, most recent first", async () => {
            const ownerId = await insertUser({ username: "owner_user" });
            const collaboratorId = await insertUser();
            const olderInvite = await insertPlaylist(ownerId, { name: "Older invite" });
            await repo.invite(olderInvite, collaboratorId);
            await new Promise((resolve) => setTimeout(resolve, 10));
            const newerInvite = await insertPlaylist(ownerId, { name: "Newer invite" });
            await repo.invite(newerInvite, collaboratorId);

            const result = await repo.getPendingByUserId(collaboratorId);

            expect(result.map((i) => i.playlistName)).toEqual(["Newer invite", "Older invite"]);
            expect(result[0].ownerUsername).toBe("owner_user");
        });

        it("excludes already-accepted invites", async () => {
            const ownerId = await insertUser();
            const collaboratorId = await insertUser();
            const playlistId = await insertPlaylist(ownerId);
            await repo.invite(playlistId, collaboratorId);
            await repo.accept(playlistId, collaboratorId);

            const result = await repo.getPendingByUserId(collaboratorId);

            expect(result).toEqual([]);
        });
    });
});
