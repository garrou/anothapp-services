import { describe, it, expect, vi, beforeEach } from "vitest";
import EpisodeService from "./episodeService.js";

const episodeRepoMocks = vi.hoisted(() => ({
    getEpisodesByShowIdBySeason: vi.fn(),
    getEpisodeById: vi.fn(),
    upsertEpisode: vi.fn(),
}));
const userEpisodeRepoMocks = vi.hoisted(() => ({
    createPlaceholders: vi.fn(),
    topUpWatched: vi.fn(),
    watch: vi.fn(),
    unwatch: vi.fn(),
    getViews: vi.fn(),
    getBySeasonForUser: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getUserSeasonsByUserId: vi.fn(),
}));
const searchServiceMocks = vi.hoisted(() => ({
    getEpisodesByShowIdBySeason: vi.fn(),
}));

vi.mock("../repositories/episodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeRepoMocks; }),
}));
vi.mock("../repositories/userEpisodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeRepoMocks; }),
}));
vi.mock("../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("./searchService.js", () => ({
    default: vi.fn().mockImplementation(function () { return searchServiceMocks; }),
}));

describe("EpisodeService.watch", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when no episodeId is given", async () => {
        await expect(episodeService.watch("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 404 when the episode doesn't exist", async () => {
        episodeRepoMocks.getEpisodeById.mockResolvedValue(null);

        await expect(episodeService.watch("user-1", 1)).rejects.toThrow("Épisode introuvable");
    });

    it("rejects with a 400 when the episode has no air date yet", async () => {
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, date: null });

        await expect(episodeService.watch("user-1", 1)).rejects.toThrow("Cet épisode n'est pas encore diffusé");
        expect(userEpisodeRepoMocks.watch).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when the episode airs in the future", async () => {
        const future = new Date(Date.now() + 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, date: future });

        await expect(episodeService.watch("user-1", 1)).rejects.toThrow("Cet épisode n'est pas encore diffusé");
    });

    it("marks the episode watched and returns the new view count when already aired", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, date: past });
        userEpisodeRepoMocks.getViews.mockResolvedValue(1);

        const views = await episodeService.watch("user-1", 1);

        expect(userEpisodeRepoMocks.watch).toHaveBeenCalledWith("user-1", 1);
        expect(views).toBe(1);
    });
});

describe("EpisodeService.unwatch", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when no episodeId is given", async () => {
        await expect(episodeService.unwatch("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when there is nothing to remove", async () => {
        userEpisodeRepoMocks.unwatch.mockResolvedValue(false);

        await expect(episodeService.unwatch("user-1", 1)).rejects.toThrow("Aucun visionnage à supprimer");
    });

    it("returns the new view count after removing the last viewing", async () => {
        userEpisodeRepoMocks.unwatch.mockResolvedValue(true);
        userEpisodeRepoMocks.getViews.mockResolvedValue(0);

        const views = await episodeService.unwatch("user-1", 1);

        expect(views).toBe(0);
    });
});

describe("EpisodeService.getBySeasonForUser", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when showId or seasonNumber is missing", async () => {
        await expect(episodeService.getBySeasonForUser("user-1", undefined, 1)).rejects.toThrow("Requête invalide");
        await expect(episodeService.getBySeasonForUser("user-1", 42, undefined)).rejects.toThrow("Requête invalide");
    });

    it("delegates to the repository", async () => {
        userEpisodeRepoMocks.getBySeasonForUser.mockResolvedValue(["episode-checklist"]);

        const result = await episodeService.getBySeasonForUser("user-1", 42, 1);

        expect(result).toEqual(["episode-checklist"]);
        expect(userEpisodeRepoMocks.getBySeasonForUser).toHaveBeenCalledWith("user-1", 42, 1);
    });
});

describe("EpisodeService.trackSeason", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("creates placeholders from episodes already stored locally", async () => {
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1 }, { id: 2 }]);

        await episodeService.trackSeason("user-1", 42, 1);

        expect(searchServiceMocks.getEpisodesByShowIdBySeason).not.toHaveBeenCalled();
        expect(userEpisodeRepoMocks.createPlaceholders).toHaveBeenCalledWith("user-1", [1, 2]);
    });

    it("fetches and stores episodes from BetaSeries when none exist locally yet", async () => {
        episodeRepoMocks.getEpisodesByShowIdBySeason
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 1 }]);
        searchServiceMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1, title: "Pilot", code: "S01E01", global: 1, number: 1, length: 45, date: "2020-01-01" },
        ]);

        await episodeService.trackSeason("user-1", 42, 1);

        expect(episodeRepoMocks.upsertEpisode).toHaveBeenCalledWith(
            1, 42, 1, 1, "Pilot", "S01E01", 1, 45, "2020-01-01"
        );
        expect(userEpisodeRepoMocks.createPlaceholders).toHaveBeenCalledWith("user-1", [1]);
    });
});

describe("EpisodeService.backfillForUser", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("backfills every tracked season with a watched row dated at the season's added_at", async () => {
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([
            { showId: 42, number: 1, addedAt: "2023-05-01" },
        ]);
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1 }, { id: 2 }]);

        await episodeService.backfillForUser("user-1");

        expect(userEpisodeRepoMocks.topUpWatched).toHaveBeenCalledWith("user-1", 1, ["2023-05-01"]);
        expect(userEpisodeRepoMocks.topUpWatched).toHaveBeenCalledWith("user-1", 2, ["2023-05-01"]);
    });

    it("backfills a rewatched season with one watched row per episode per viewing", async () => {
        // same show_id/number appearing twice = the season was watched twice
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([
            { showId: 42, number: 1, addedAt: "2022-01-01" },
            { showId: 42, number: 1, addedAt: "2023-05-01" },
        ]);
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1 }]);

        await episodeService.backfillForUser("user-1");

        expect(episodeRepoMocks.getEpisodesByShowIdBySeason).toHaveBeenCalledOnce();
        expect(userEpisodeRepoMocks.topUpWatched).toHaveBeenCalledWith(
            "user-1", 1, ["2022-01-01", "2023-05-01"]
        );
    });

    it("does nothing when the user has no tracked seasons", async () => {
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([]);

        await episodeService.backfillForUser("user-1");

        expect(userEpisodeRepoMocks.topUpWatched).not.toHaveBeenCalled();
    });
});
