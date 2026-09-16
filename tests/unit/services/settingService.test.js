import {describe, it, expect, vi, beforeEach} from "vitest";
import SettingService from "../../../services/settingService.js";

const userServiceMocks = vi.hoisted(() => ({markExported: vi.fn(), getUser: vi.fn()}));
const statServiceMocks = vi.hoisted(() => ({getStats: vi.fn()}));
const playlistServiceMocks = vi.hoisted(() => ({getPlaylists: vi.fn()}));
const achievementServiceMocks = vi.hoisted(() => ({getAchievements: vi.fn(), evaluate: vi.fn()}));
const userShowRepoMocks = vi.hoisted(() => ({
    getShowsByUserId: vi.fn(), checkShowExistsByUserIdByShowId: vi.fn(), create: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getUserSeasonsByUserId: vi.fn(), findImportedViewing: vi.fn(), create: vi.fn(),
}));
const userEpisodeRepoMocks = vi.hoisted(() => ({getAllByUserId: vi.fn(), createIfMissing: vi.fn()}));
const friendRepoMocks = vi.hoisted(() => ({getFriends: vi.fn()}));
const userFavoriteActorRepoMocks = vi.hoisted(() => ({
    getFavoritesByUserId: vi.fn(), checkFavoriteExists: vi.fn(), create: vi.fn(),
}));
const userPlatformRepoMocks = vi.hoisted(() => ({getUserPlatforms: vi.fn(), addUserPlatforms: vi.fn()}));
const playlistRepoMocks = vi.hoisted(() => ({
    getShowsByPlaylistId: vi.fn(), create: vi.fn(), addShow: vi.fn(), getByUserIdAndName: vi.fn(),
}));
vi.mock("../../../services/userService.js", () => ({
    default: vi.fn().mockImplementation(function () { return userServiceMocks; }),
}));
vi.mock("../../../services/statService.js", () => ({
    default: vi.fn().mockImplementation(function () { return statServiceMocks; }),
}));
vi.mock("../../../services/playlistService.js", () => ({
    default: vi.fn().mockImplementation(function () { return playlistServiceMocks; }),
}));
vi.mock("../../../services/achievementService.js", () => ({
    default: vi.fn().mockImplementation(function () { return achievementServiceMocks; }),
}));
vi.mock("../../../repositories/userShowRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userShowRepoMocks; }),
}));
vi.mock("../../../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../../../repositories/userEpisodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeRepoMocks; }),
}));
vi.mock("../../../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));
vi.mock("../../../repositories/userFavoriteActorRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userFavoriteActorRepoMocks; }),
}));
vi.mock("../../../repositories/userPlatformRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userPlatformRepoMocks; }),
}));
vi.mock("../../../repositories/playlistRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return playlistRepoMocks; }),
}));

describe("SettingService.exportData", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SettingService();

        userShowRepoMocks.getShowsByUserId.mockResolvedValue([]);
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([]);
        userEpisodeRepoMocks.getAllByUserId.mockResolvedValue([]);
        statServiceMocks.getStats.mockResolvedValue({});
        friendRepoMocks.getFriends.mockResolvedValue([]);
        playlistServiceMocks.getPlaylists.mockResolvedValue([]);
        userFavoriteActorRepoMocks.getFavoritesByUserId.mockResolvedValue([]);
        userPlatformRepoMocks.getUserPlatforms.mockResolvedValue([]);
        achievementServiceMocks.getAchievements.mockResolvedValue([]);
        playlistRepoMocks.getShowsByPlaylistId.mockResolvedValue([]);
    });

    it("throws when the user already exported recently", async () => {
        userServiceMocks.markExported.mockResolvedValue(false);

        await expect(service.exportData("user-1")).rejects.toMatchObject({status: 400});
        expect(userServiceMocks.getUser).not.toHaveBeenCalled();
    });

    it("builds the export with shows, their seasons and episodes nested", async () => {
        userServiceMocks.markExported.mockResolvedValue(true);
        userServiceMocks.getUser.mockResolvedValue({id: "user-1", email: "a@b.com", username: "bob", picture: null, episodeTrackingEnabled: true, createdAt: "2023-01-01"});
        userShowRepoMocks.getShowsByUserId.mockResolvedValue([
            {id: 10, title: "Show", kinds: ["Drame"], country: "FR", seasons: 1, favorite: false, watch: true, duration: 42, note: 3, addedAt: "2024-01-01"},
        ]);
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([
            {id: 5, number: 1, addedAt: "2024-01-01", platform: "Netflix", platformId: 1, showId: 10},
        ]);
        userEpisodeRepoMocks.getAllByUserId.mockResolvedValue([
            {userSeasonId: 5, episode: {id: 1, title: "Pilot", code: "S01E01", number: 1}},
        ]);
        statServiceMocks.getStats.mockResolvedValue({total: 1});

        const [filename, exportedData] = await service.exportData("user-1");

        expect(filename).toMatch(/^user-data-user-1-\d{4}-\d{2}-\d{2}\.json$/);
        expect(exportedData.user).toEqual({
            username: "bob", email: "a@b.com", picture: null, episodeTrackingEnabled: true, createdAt: "2023-01-01",
        });
        expect(exportedData.user.id).toBeUndefined();
        expect(exportedData.stats).toEqual({total: 1});
        expect(exportedData.shows).toHaveLength(1);
        expect(exportedData.shows[0].id).toBe(10);
        expect(exportedData.shows[0].seasons).toHaveLength(1);
        expect(exportedData.shows[0].seasons[0].episodes).toEqual([{id: 1, title: "Pilot", code: "S01E01", number: 1}]);
    });

    it("leaves a show's seasons empty when the user has no season logged for it", async () => {
        userServiceMocks.markExported.mockResolvedValue(true);
        userServiceMocks.getUser.mockResolvedValue({id: "user-1"});
        userShowRepoMocks.getShowsByUserId.mockResolvedValue([
            {id: 10, title: "Show", kinds: [], country: "FR", seasons: 1, favorite: false, watch: true, duration: 42, note: null, addedAt: "2024-01-01"},
        ]);

        const [, exportedData] = await service.exportData("user-1");

        expect(exportedData.shows[0].seasons).toEqual([]);
    });

    it("includes friends, playlists, favorite actors, platforms and achievements", async () => {
        userServiceMocks.markExported.mockResolvedValue(true);
        userServiceMocks.getUser.mockResolvedValue({id: "user-1"});
        friendRepoMocks.getFriends.mockResolvedValue([{id: "friend-1", username: "alice"}]);
        playlistServiceMocks.getPlaylists.mockResolvedValue([{id: 1, name: "My playlist", role: "owner"}]);
        userFavoriteActorRepoMocks.getFavoritesByUserId.mockResolvedValue([{id: 99, name: "Actor"}]);
        userPlatformRepoMocks.getUserPlatforms.mockResolvedValue([1, 2]);
        achievementServiceMocks.getAchievements.mockResolvedValue([{code: "rewatch", value: 4}]);

        const [, exportedData] = await service.exportData("user-1");

        expect(playlistServiceMocks.getPlaylists).toHaveBeenCalledWith("user-1");
        expect(achievementServiceMocks.getAchievements).toHaveBeenCalledWith("user-1");
        expect(exportedData.friends).toEqual([{id: "friend-1", username: "alice"}]);
        expect(exportedData.favoriteActors).toEqual([{id: 99, name: "Actor"}]);
        expect(exportedData.platforms).toEqual([1, 2]);
        expect(exportedData.achievements).toEqual([{code: "rewatch", value: 4}]);
    });

    it("nests each playlist's shows in the export", async () => {
        userServiceMocks.markExported.mockResolvedValue(true);
        userServiceMocks.getUser.mockResolvedValue({id: "user-1"});
        playlistServiceMocks.getPlaylists.mockResolvedValue([
            {id: 1, name: "My playlist", role: "owner"},
            {id: 2, name: "Shared playlist", role: "collaborator"},
        ]);
        playlistRepoMocks.getShowsByPlaylistId.mockImplementation((playlistId) =>
            Promise.resolve(playlistId === 1 ? [{id: 10, title: "Show A"}] : [])
        );

        const [, exportedData] = await service.exportData("user-1");

        expect(playlistRepoMocks.getShowsByPlaylistId).toHaveBeenCalledWith(1);
        expect(playlistRepoMocks.getShowsByPlaylistId).toHaveBeenCalledWith(2);
        expect(exportedData.playlists[0].shows).toEqual([{id: 10, title: "Show A"}]);
        expect(exportedData.playlists[1].shows).toEqual([]);
    });
});

describe("SettingService.importData", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SettingService();

        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        userShowRepoMocks.create.mockResolvedValue(true);
        userSeasonRepoMocks.findImportedViewing.mockResolvedValue(null);
        userSeasonRepoMocks.create.mockResolvedValue(5);
        userEpisodeRepoMocks.createIfMissing.mockResolvedValue(true);
        playlistRepoMocks.create.mockResolvedValue({id: 1});
        playlistRepoMocks.addShow.mockResolvedValue(true);
        playlistRepoMocks.getByUserIdAndName.mockResolvedValue(null);
        userFavoriteActorRepoMocks.checkFavoriteExists.mockResolvedValue(false);
        userPlatformRepoMocks.addUserPlatforms.mockResolvedValue(true);
        achievementServiceMocks.evaluate.mockResolvedValue([]);
    });

    it("rejects a payload without a shows array", async () => {
        await expect(service.importData("user-1", {})).rejects.toMatchObject({status: 400});
        expect(userShowRepoMocks.create).not.toHaveBeenCalled();
    });

    it("rejects a missing payload", async () => {
        await expect(service.importData("user-1", null)).rejects.toMatchObject({status: 400});
    });

    it("adds a show to the user's collection and its seasons/episodes, without touching the shared catalog", async () => {
        const payload = {
            shows: [{
                id: 10, title: "Show", isFavorite: true, isWatching: false, note: 4, addedAt: "2024-01-01",
                seasons: [{
                    number: 1, platformId: 2, addedAt: "2024-01-01",
                    episodes: [{episodeId: 100, number: 1, title: "Pilot", code: "S01E01", watchedAt: "2024-01-02"}],
                }],
            }],
        };

        const summary = await service.importData("user-1", payload);

        expect(userShowRepoMocks.create).toHaveBeenCalledWith("user-1", 10, {
            favorite: true, watch: false, note: 4, addedAt: "2024-01-01",
        });
        expect(userSeasonRepoMocks.create).toHaveBeenCalledWith("user-1", 10, 1, 2, "2024-01-01");
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("user-1", 5, 100, "2024-01-02", 2);
        expect(summary.shows).toEqual({imported: 1, errors: 0});
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1");
    });

    it("reports a per-show error when the show isn't already in the shared catalog (FK violation)", async () => {
        const fkViolation = new Error("insert or update on table \"users_shows\" violates foreign key constraint");
        fkViolation.code = "23503";
        userShowRepoMocks.create.mockRejectedValueOnce(fkViolation);

        const summary = await service.importData("user-1", {
            shows: [{id: 999999, title: "Unknown show", seasons: []}],
        });

        expect(summary.shows).toEqual({imported: 0, errors: 1});
        expect(summary.errors[0]).toContain("Unknown show");
    });

    it("does not re-add the show when it's already in the user's collection", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(true);

        await service.importData("user-1", {shows: [{id: 10, title: "Show", seasons: []}]});

        expect(userShowRepoMocks.create).not.toHaveBeenCalled();
    });

    it("reuses an already-imported viewing instead of creating a duplicate", async () => {
        userSeasonRepoMocks.findImportedViewing.mockResolvedValue(42);

        await service.importData("user-1", {
            shows: [{id: 10, title: "Show", seasons: [{number: 1, addedAt: "2024-01-01", episodes: []}]}],
        });

        expect(userSeasonRepoMocks.create).not.toHaveBeenCalled();
    });

    it("keeps going and reports per-show errors instead of failing the whole import", async () => {
        userShowRepoMocks.create.mockRejectedValueOnce(new Error("boom"));

        const summary = await service.importData("user-1", {
            shows: [{id: 10, title: "Broken show", seasons: []}],
        });

        expect(summary.shows).toEqual({imported: 0, errors: 1});
        expect(summary.errors[0]).toContain("Broken show");
    });

    it("recreates an owned playlist and its shows", async () => {
        const payload = {
            shows: [],
            playlists: [{id: 1, name: "My playlist", role: "owner", shows: [{id: 10, title: "Show"}]}],
        };

        const summary = await service.importData("user-1", payload);

        expect(playlistRepoMocks.create).toHaveBeenCalledWith("user-1", "My playlist", false);
        expect(playlistRepoMocks.addShow).toHaveBeenCalledWith(1, 10);
        expect(summary.playlists).toEqual({imported: 1, errors: 0});
    });

    it("reuses an already-imported playlist by name instead of creating a duplicate", async () => {
        playlistRepoMocks.getByUserIdAndName.mockResolvedValue({id: 7});

        const summary = await service.importData("user-1", {
            shows: [], playlists: [{name: "My playlist", role: "owner", shows: [{id: 10, title: "Show"}]}],
        });

        expect(playlistRepoMocks.create).not.toHaveBeenCalled();
        expect(playlistRepoMocks.addShow).toHaveBeenCalledWith(7, 10);
        expect(summary.playlists).toEqual({imported: 1, errors: 0});
    });

    it("skips playlists the exporting user only collaborated on", async () => {
        await service.importData("user-1", {
            shows: [], playlists: [{id: 2, name: "Shared", role: "collaborator", shows: []}],
        });

        expect(playlistRepoMocks.create).not.toHaveBeenCalled();
    });

    it("adds a favorite actor to the user's own favorites, without touching the shared catalog", async () => {
        await service.importData("user-1", {shows: [], favoriteActors: [{id: 99, name: "Actor"}]});

        expect(userFavoriteActorRepoMocks.create).toHaveBeenCalledWith("user-1", 99);
    });

    it("does not re-add an actor already in the user's favorites", async () => {
        userFavoriteActorRepoMocks.checkFavoriteExists.mockResolvedValue(true);

        await service.importData("user-1", {shows: [], favoriteActors: [{id: 99, name: "Actor"}]});

        expect(userFavoriteActorRepoMocks.create).not.toHaveBeenCalled();
    });

    it("reports a per-actor error when the actor isn't in the shared catalog (FK violation)", async () => {
        const fkViolation = new Error("violates foreign key constraint");
        fkViolation.code = "23503";
        userFavoriteActorRepoMocks.create.mockRejectedValueOnce(fkViolation);

        const summary = await service.importData("user-1", {
            shows: [], favoriteActors: [{id: 999999, name: "Unknown actor"}],
        });

        expect(summary.favoriteActors).toEqual({imported: 0, errors: 1});
        expect(summary.errors[0]).toContain("Unknown actor");
    });

    it("imports platforms, ignoring an already-existing one", async () => {
        userPlatformRepoMocks.addUserPlatforms
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce({code: "23505"});

        const summary = await service.importData("user-1", {shows: [], platforms: [1, 2]});

        expect(summary.platforms).toEqual({imported: 1, errors: 0});
    });
});
