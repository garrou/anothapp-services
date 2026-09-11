import {describe, it, expect, vi, beforeEach} from "vitest";
import PlaylistService from "./playlistService.js";
import { PLAYLIST_NOT_FOUND } from "../constants/errors.js";

const playlistRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    getById: vi.fn(),
    getByUserId: vi.fn(),
    getVisibleByUserId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addShow: vi.fn(),
    removeShow: vi.fn(),
    getShowsByPlaylistId: vi.fn(),
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

    it("returns the current user's own playlists when no friendId is given", async () => {
        playlistRepoMocks.getByUserId.mockResolvedValue([ownedPlaylist]);

        const result = await playlistService.getPlaylists("user-1", undefined);

        expect(result).toEqual([ownedPlaylist]);
        expect(playlistRepoMocks.getVisibleByUserId).not.toHaveBeenCalled();
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
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);
        playlistRepoMocks.getShowsByPlaylistId.mockResolvedValue([{id: 42, title: "Breaking Bad"}]);

        const result = await playlistService.getPlaylistById("user-1", 1);

        expect(result).toEqual({playlist: ownedPlaylist, shows: [{id: 42, title: "Breaking Bad"}]});
        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when a non-owner requests a private playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(ownedPlaylist);

        await expect(playlistService.getPlaylistById("user-2", 1)).rejects.toThrow(PLAYLIST_NOT_FOUND);
        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when a non-friend requests a visible playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(playlistService.getPlaylistById("user-1", 2)).rejects.toThrow(PLAYLIST_NOT_FOUND);
    });

    it("returns a friend's visible playlist", async () => {
        playlistRepoMocks.getById.mockResolvedValue(friendPlaylist);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        playlistRepoMocks.getShowsByPlaylistId.mockResolvedValue([]);

        const result = await playlistService.getPlaylistById("user-1", 2);

        expect(result.playlist).toEqual(friendPlaylist);
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
});
