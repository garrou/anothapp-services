import {describe, it, expect, vi, beforeEach} from "vitest";
import PlaylistService from "./playlistService.js";
import { PLAYLIST_NOT_FOUND, ERROR_ALREADY_COLLABORATOR, ERROR_COLLABORATOR_INVITE_NOT_FOUND } from "../constants/errors.js";

const playlistRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    getById: vi.fn(),
    getByUserId: vi.fn(),
    getCollaboratingByUserId: vi.fn(),
    getVisibleByUserId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addShow: vi.fn(),
    removeShow: vi.fn(),
    getShowsByPlaylistId: vi.fn(),
}));
const playlistCollaboratorRepoMocks = vi.hoisted(() => ({
    invite: vi.fn(),
    accept: vi.fn(),
    remove: vi.fn(),
    checkExists: vi.fn(),
    checkIsAcceptedCollaborator: vi.fn(),
    getByPlaylistId: vi.fn(),
    getOne: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    checkIfAlreadyFriend: vi.fn(),
}));
const showServiceMocks = vi.hoisted(() => ({
    ensureShowExists: vi.fn(),
}));
const eventBusMocks = vi.hoisted(() => ({
    emit: vi.fn(),
}));

vi.mock("../repositories/playlistRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return playlistRepoMocks; }),
}));
vi.mock("../repositories/playlistCollaboratorRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return playlistCollaboratorRepoMocks; }),
}));
vi.mock("../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));
vi.mock("./showService.js", () => ({
    default: vi.fn().mockImplementation(function () { return showServiceMocks; }),
}));
vi.mock("../helpers/eventBus.js", () => ({
    default: eventBusMocks,
}));

const ownedPlaylist = {id: 1, userId: "user-1", name: "Mes séries", visible: false};
const friendPlaylist = {id: 2, userId: "user-2", name: "Anime", visible: true};

describe("PlaylistService.getPlaylists", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("returns the current user's own playlists, tagged as owner, when no friendId is given", async () => {
        playlistRepoMocks.getByUserId.mockResolvedValue([{...ownedPlaylist}]);
        playlistRepoMocks.getCollaboratingByUserId.mockResolvedValue([]);

        const result = await playlistService.getPlaylists("user-1", undefined);

        expect(result).toEqual([{...ownedPlaylist, role: "owner"}]);
        expect(playlistRepoMocks.getVisibleByUserId).not.toHaveBeenCalled();
    });

    it("appends the playlists the user collaborates on, tagged as collaborator", async () => {
        playlistRepoMocks.getByUserId.mockResolvedValue([{...ownedPlaylist}]);
        playlistRepoMocks.getCollaboratingByUserId.mockResolvedValue([{...friendPlaylist}]);

        const result = await playlistService.getPlaylists("user-1", undefined);

        expect(result).toEqual([
            {...ownedPlaylist, role: "owner"},
            {...friendPlaylist, role: "collaborator"},
        ]);
    });

    it("rejects with a 400 when filtering by a friendId that isn't actually a friend", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(
            playlistService.getPlaylists("user-1", "user-2")
        ).rejects.toThrow("Vous n'êtes pas en relation avec cette personne");
    });

    it("returns only the friend's visible playlists", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        playlistRepoMocks.getVisibleByUserId.mockResolvedValue([friendPlaylist]);

        const result = await playlistService.getPlaylists("user-1", "user-2");

        expect(result).toEqual([friendPlaylist]);
        expect(playlistRepoMocks.getVisibleByUserId).toHaveBeenCalledWith("user-2");
    });
});

describe("PlaylistService.getPlaylistById", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
        playlistRepoMocks.getShowsByPlaylistId.mockResolvedValue([]);
    });

    it("rejects with a 400 when the playlist doesn't exist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(null);

        await expect(playlistService.getPlaylistById("user-1", 99)).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("returns the playlist and its shows for its owner", async () => {
        const playlist = {...ownedPlaylist};
        playlistRepoMocks.getById.mockResolvedValue(playlist);
        playlistRepoMocks.getShowsByPlaylistId.mockResolvedValue([{id: 42, title: "Breaking Bad"}]);

        const result = await playlistService.getPlaylistById("user-1", 1);

        expect(result).toEqual({playlist: {...ownedPlaylist, role: "owner"}, shows: [{id: 42, title: "Breaking Bad"}]});
        expect(playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator).not.toHaveBeenCalled();
        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });

    it("returns the playlist and its shows for an accepted collaborator, regardless of visibility", async () => {
        const playlist = {...ownedPlaylist};
        playlistRepoMocks.getById.mockResolvedValue(playlist);
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(true);
        playlistRepoMocks.getShowsByPlaylistId.mockResolvedValue([]);

        const result = await playlistService.getPlaylistById("user-2", 1);

        expect(result.playlist).toEqual({...ownedPlaylist, role: "collaborator"});
        expect(playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator).toHaveBeenCalledWith(1, "user-2");
        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when a non-owner, non-collaborator requests a private playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue({...ownedPlaylist});
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(false);

        await expect(playlistService.getPlaylistById("user-2", 1)).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when a non-friend requests a visible playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue({...friendPlaylist});
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(false);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(playlistService.getPlaylistById("user-1", 2)).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("returns a friend's visible playlist as a viewer", async () => {
        playlistRepoMocks.getById.mockResolvedValue({...friendPlaylist});
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(false);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        playlistRepoMocks.getShowsByPlaylistId.mockResolvedValue([]);

        const result = await playlistService.getPlaylistById("user-1", 2);

        expect(result.playlist).toEqual({...friendPlaylist, role: "viewer"});
    });
});

describe("PlaylistService.createPlaylist", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 for an empty name", async () => {
        await expect(playlistService.createPlaylist("user-1", "   ")).rejects.toThrow("Requête invalide");
        expect(playlistRepoMocks.create).not.toHaveBeenCalled();
    });

    it("rejects with a 400 for a name over 255 characters", async () => {
        await expect(playlistService.createPlaylist("user-1", "a".repeat(256))).rejects.toThrow("Requête invalide");
    });

    it("trims the name and defaults visible to false", async () => {
        playlistRepoMocks.create.mockResolvedValue(ownedPlaylist);

        await playlistService.createPlaylist("user-1", "  Mes séries  ");

        expect(playlistRepoMocks.create).toHaveBeenCalledWith("user-1", "Mes séries", false);
    });

    it("passes visible through when explicitly set", async () => {
        playlistRepoMocks.create.mockResolvedValue(ownedPlaylist);

        await playlistService.createPlaylist("user-1", "Mes séries", true);

        expect(playlistRepoMocks.create).toHaveBeenCalledWith("user-1", "Mes séries", true);
    });

    it("emits playlist.created once the playlist is created", async () => {
        playlistRepoMocks.create.mockResolvedValue(ownedPlaylist);

        await playlistService.createPlaylist("user-1", "Mes séries");

        expect(eventBusMocks.emit).toHaveBeenCalledWith("playlist.created", {actorUserId: "user-1"});
    });
});

describe("PlaylistService.updatePlaylist", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when the playlist isn't owned by the current user", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);

        await expect(
            playlistService.updatePlaylist("user-1", 2, {name: "Nouveau nom"})
        ).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(playlistRepoMocks.update).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when the playlist doesn't exist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(null);

        await expect(
            playlistService.updatePlaylist("user-1", 99, {name: "Nouveau nom"})
        ).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("rejects with a 400 when clearing the name to blank", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);

        await expect(
            playlistService.updatePlaylist("user-1", 1, {name: "   "})
        ).rejects.toThrow("Requête invalide");
    });

    it("updates the owner's playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistRepoMocks.update.mockResolvedValue(true);

        await playlistService.updatePlaylist("user-1", 1, {name: "  Nouveau nom  ", visible: true});

        expect(playlistRepoMocks.update).toHaveBeenCalledWith(1, {name: "Nouveau nom", visible: true});
    });

    it("throws a 500 when the update fails unexpectedly", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistRepoMocks.update.mockResolvedValue(false);

        await expect(
            playlistService.updatePlaylist("user-1", 1, {visible: true})
        ).rejects.toThrow("Impossible de modifier la playlist");
    });
});

describe("PlaylistService.deletePlaylist", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when the playlist isn't owned by the current user", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);

        await expect(playlistService.deletePlaylist("user-1", 2)).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(playlistRepoMocks.delete).not.toHaveBeenCalled();
    });

    it("deletes the owner's playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistRepoMocks.delete.mockResolvedValue(true);

        await playlistService.deletePlaylist("user-1", 1);

        expect(playlistRepoMocks.delete).toHaveBeenCalledWith(1);
    });
});

describe("PlaylistService.addShowToPlaylist", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when no showId is given", async () => {
        await expect(playlistService.addShowToPlaylist("user-1", 1, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the playlist isn't owned by the current user", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);

        await expect(playlistService.addShowToPlaylist("user-1", 2, 42)).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(showServiceMocks.ensureShowExists).not.toHaveBeenCalled();
    });

    it("ensures the show exists locally (even if the owner hasn't tracked it) and adds it", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        showServiceMocks.ensureShowExists.mockResolvedValue({id: 42, title: "Breaking Bad"});

        await playlistService.addShowToPlaylist("user-1", 1, 42);

        expect(showServiceMocks.ensureShowExists).toHaveBeenCalledWith(42);
        expect(playlistRepoMocks.addShow).toHaveBeenCalledWith(1, 42);
    });

    it("lets an accepted collaborator add a show", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(true);
        showServiceMocks.ensureShowExists.mockResolvedValue({id: 42, title: "Breaking Bad"});

        await playlistService.addShowToPlaylist("user-1", 2, 42);

        expect(playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator).toHaveBeenCalledWith(2, "user-1");
        expect(playlistRepoMocks.addShow).toHaveBeenCalledWith(2, 42);
    });

    it("rejects a non-collaborator friend who isn't the owner", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(false);

        await expect(playlistService.addShowToPlaylist("user-1", 2, 42)).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(showServiceMocks.ensureShowExists).not.toHaveBeenCalled();
    });
});

describe("PlaylistService.removeShowFromPlaylist", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when the playlist isn't owned by the current user", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);

        await expect(playlistService.removeShowFromPlaylist("user-1", 2, 42)).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(playlistRepoMocks.removeShow).not.toHaveBeenCalled();
    });

    it("removes the show from the owner's playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistRepoMocks.removeShow.mockResolvedValue(true);

        await playlistService.removeShowFromPlaylist("user-1", 1, 42);

        expect(playlistRepoMocks.removeShow).toHaveBeenCalledWith(1, 42);
    });

    it("throws a 500 when the show wasn't in the playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistRepoMocks.removeShow.mockResolvedValue(false);

        await expect(
            playlistService.removeShowFromPlaylist("user-1", 1, 42)
        ).rejects.toThrow("Impossible de retirer la série de la playlist");
    });

    it("lets an accepted collaborator remove a show", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(true);
        playlistRepoMocks.removeShow.mockResolvedValue(true);

        await playlistService.removeShowFromPlaylist("user-1", 2, 42);

        expect(playlistRepoMocks.removeShow).toHaveBeenCalledWith(2, 42);
    });
});

describe("PlaylistService.inviteCollaborator", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when no friendUserId is given", async () => {
        await expect(playlistService.inviteCollaborator("user-1", 1, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the playlist isn't owned by the current user", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);

        await expect(playlistService.inviteCollaborator("user-1", 2, "user-3")).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when the target isn't a friend", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(playlistService.inviteCollaborator("user-1", 1, "user-3")).rejects.toThrow("Vous n'êtes pas en relation avec cette personne");
        expect(playlistCollaboratorRepoMocks.invite).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when the friend is already invited or a collaborator", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        playlistCollaboratorRepoMocks.checkExists.mockResolvedValue(true);

        await expect(playlistService.inviteCollaborator("user-1", 1, "user-3")).rejects.toThrow(ERROR_ALREADY_COLLABORATOR);
        expect(playlistCollaboratorRepoMocks.invite).not.toHaveBeenCalled();
    });

    it("invites the friend and emits playlist.collaborator_invited", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        playlistCollaboratorRepoMocks.checkExists.mockResolvedValue(false);
        playlistCollaboratorRepoMocks.invite.mockResolvedValue(true);

        await playlistService.inviteCollaborator("user-1", 1, "user-3");

        expect(playlistCollaboratorRepoMocks.invite).toHaveBeenCalledWith(1, "user-3");
        expect(eventBusMocks.emit).toHaveBeenCalledWith("playlist.collaborator_invited", {
            recipientUserId: "user-3", actorUserId: "user-1",
            metadata: {playlistId: 1, playlistName: ownedPlaylist.name},
        });
    });
});

describe("PlaylistService.acceptCollaboratorInvite", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when the playlist doesn't exist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(null);

        await expect(playlistService.acceptCollaboratorInvite("user-3", 99)).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("rejects with a 400 when there was no pending invite", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.accept.mockResolvedValue(false);

        await expect(playlistService.acceptCollaboratorInvite("user-3", 1)).rejects.toThrow(ERROR_COLLABORATOR_INVITE_NOT_FOUND);
    });

    it("accepts the invite and notifies the owner", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.accept.mockResolvedValue(true);

        await playlistService.acceptCollaboratorInvite("user-3", 1);

        expect(playlistCollaboratorRepoMocks.accept).toHaveBeenCalledWith(1, "user-3");
        expect(eventBusMocks.emit).toHaveBeenCalledWith("playlist.collaborator_accepted", {
            recipientUserId: "user-1", actorUserId: "user-3",
            metadata: {playlistId: 1, playlistName: ownedPlaylist.name},
        });
    });
});

describe("PlaylistService.removeCollaborator", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when the playlist doesn't exist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(null);

        await expect(playlistService.removeCollaborator("user-1", 99, "user-3")).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("rejects with a 400 when a non-owner tries to remove someone else", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);

        await expect(playlistService.removeCollaborator("user-2", 1, "user-3")).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(playlistCollaboratorRepoMocks.remove).not.toHaveBeenCalled();
    });

    it("lets the owner remove a collaborator without emitting a notification", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.getOne.mockResolvedValue({accepted: true});
        playlistCollaboratorRepoMocks.remove.mockResolvedValue(true);

        await playlistService.removeCollaborator("user-1", 1, "user-3");

        expect(playlistCollaboratorRepoMocks.remove).toHaveBeenCalledWith(1, "user-3");
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("lets a collaborator leave voluntarily after accepting, without emitting a notification", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.getOne.mockResolvedValue({accepted: true});
        playlistCollaboratorRepoMocks.remove.mockResolvedValue(true);

        await playlistService.removeCollaborator("user-3", 1, "user-3");

        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("notifies the owner when a pending invite is declined", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.getOne.mockResolvedValue({accepted: false});
        playlistCollaboratorRepoMocks.remove.mockResolvedValue(true);

        await playlistService.removeCollaborator("user-3", 1, "user-3");

        expect(eventBusMocks.emit).toHaveBeenCalledWith("playlist.collaborator_declined", {
            recipientUserId: "user-1", actorUserId: "user-3",
            metadata: {playlistId: 1, playlistName: ownedPlaylist.name},
        });
    });

    it("throws a 500 when nothing was removed", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.getOne.mockResolvedValue(null);
        playlistCollaboratorRepoMocks.remove.mockResolvedValue(false);

        await expect(
            playlistService.removeCollaborator("user-1", 1, "user-3")
        ).rejects.toThrow("Impossible de retirer ce collaborateur");
    });
});

describe("PlaylistService.getCollaborators", () => {
    let playlistService;

    beforeEach(() => {
        vi.clearAllMocks();
        playlistService = new PlaylistService();
    });

    it("rejects with a 400 when the playlist doesn't exist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(null);

        await expect(playlistService.getCollaborators("user-1", 99)).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("rejects with a 400 for a user who is neither owner nor collaborator", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(false);

        await expect(playlistService.getCollaborators("user-2", 1)).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("returns the collaborators for the owner", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.getByPlaylistId.mockResolvedValue([{id: "user-3", username: "bob", accepted: true}]);

        const result = await playlistService.getCollaborators("user-1", 1);

        expect(result).toEqual([{id: "user-3", username: "bob", accepted: true}]);
    });

    it("returns the collaborators for an accepted collaborator", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistCollaboratorRepoMocks.checkIsAcceptedCollaborator.mockResolvedValue(true);
        playlistCollaboratorRepoMocks.getByPlaylistId.mockResolvedValue([]);

        const result = await playlistService.getCollaborators("user-2", 1);

        expect(result).toEqual([]);
    });
});
