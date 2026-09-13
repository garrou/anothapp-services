import {describe, it, expect, vi, beforeEach} from "vitest";
import SettingService from "./settingService.js";

const userServiceMocks = vi.hoisted(() => ({markExported: vi.fn(), getUser: vi.fn()}));
const statServiceMocks = vi.hoisted(() => ({getStats: vi.fn()}));
const userShowRepoMocks = vi.hoisted(() => ({getShowsByUserId: vi.fn()}));
const userSeasonRepoMocks = vi.hoisted(() => ({getUserSeasonsByUserId: vi.fn()}));
const userEpisodeRepoMocks = vi.hoisted(() => ({getAllByUserId: vi.fn()}));

vi.mock("./userService.js", () => ({
    default: vi.fn().mockImplementation(function () { return userServiceMocks; }),
}));
vi.mock("./statService.js", () => ({
    default: vi.fn().mockImplementation(function () { return statServiceMocks; }),
}));
vi.mock("../repositories/userShowRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userShowRepoMocks; }),
}));
vi.mock("../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../repositories/userEpisodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeRepoMocks; }),
}));

describe("SettingService.exportData", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SettingService();
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
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([]);
        userEpisodeRepoMocks.getAllByUserId.mockResolvedValue([]);
        statServiceMocks.getStats.mockResolvedValue({});

        const [, exportedData] = await service.exportData("user-1");

        expect(exportedData.shows[0].seasons).toEqual([]);
    });
});
