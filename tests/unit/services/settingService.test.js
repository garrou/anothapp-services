import {describe, it, expect, vi, beforeEach} from "vitest";
import SettingService from "../../../services/settingService.js";

const userServiceMocks = vi.hoisted(() => ({markExported: vi.fn(), getUser: vi.fn()}));
const statServiceMocks = vi.hoisted(() => ({getStats: vi.fn()}));
const playlistServiceMocks = vi.hoisted(() => ({getPlaylists: vi.fn()}));
const achievementServiceMocks = vi.hoisted(() => ({getAchievements: vi.fn()}));
const userShowRepoMocks = vi.hoisted(() => ({getShowsByUserId: vi.fn()}));
const userSeasonRepoMocks = vi.hoisted(() => ({getUserSeasonsByUserId: vi.fn()}));
const userEpisodeRepoMocks = vi.hoisted(() => ({getAllByUserId: vi.fn()}));
const friendRepoMocks = vi.hoisted(() => ({getFriends: vi.fn()}));
const userFavoriteActorRepoMocks = vi.hoisted(() => ({getFavoritesByUserId: vi.fn()}));
const userPlatformRepoMocks = vi.hoisted(() => ({getUserPlatforms: vi.fn()}));
const playlistRepoMocks = vi.hoisted(() => ({getShowsByPlaylistId: vi.fn()}));

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
        userServiceMocks.getUser.mockResolvedValue({id: "user-1", email: "a@b.com", username: "bob"});
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
        expect(exportedData.user.id).toBe("user-1");
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
