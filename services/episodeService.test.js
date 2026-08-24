import { describe, it, expect, vi, beforeEach } from "vitest";
import EpisodeService from "./episodeService.js";

const episodeRepoMocks = vi.hoisted(() => ({
    getEpisodesByShowIdBySeason: vi.fn(),
    getEpisodeById: vi.fn(),
    upsertEpisode: vi.fn(),
}));
const userEpisodeRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    createIfMissing: vi.fn(),
    existsForViewing: vi.fn(),
    updateWatchedAt: vi.fn(),
    deleteById: vi.fn(),
    getByUserSeasonId: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getUserSeasonsByUserId: vi.fn(),
    getOwnedSeasonViewing: vi.fn(),
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

describe("EpisodeService.getByUserSeasonId", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when no userSeasonId is given", async () => {
        await expect(episodeService.getByUserSeasonId("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the viewing isn't owned by the user", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue(null);

        await expect(episodeService.getByUserSeasonId("user-1", 7)).rejects.toThrow(
            "Ce visionnage n'est pas dans votre collection"
        );
    });

    it("returns the checklist for an owned viewing", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue({ showId: 42, number: 1 });
        userEpisodeRepoMocks.getByUserSeasonId.mockResolvedValue(["episode-checklist"]);

        const result = await episodeService.getByUserSeasonId("user-1", 7);

        expect(result).toEqual(["episode-checklist"]);
        expect(userEpisodeRepoMocks.getByUserSeasonId).toHaveBeenCalledWith(7, 42, 1);
    });
});

describe("EpisodeService.addViewing", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue({ showId: 42, number: 1 });
        userEpisodeRepoMocks.existsForViewing.mockResolvedValue(false);
        userEpisodeRepoMocks.create.mockResolvedValue(true);
    });

    it("rejects with a 400 when userSeasonId or episodeId is missing", async () => {
        await expect(episodeService.addViewing("user-1", undefined, 1)).rejects.toThrow("Requête invalide");
        await expect(episodeService.addViewing("user-1", 7, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the viewing isn't owned by the user", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue(null);

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Ce visionnage n'est pas dans votre collection"
        );
    });

    it("rejects with a 400 when the episode doesn't belong to that viewing's season", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 2, date: past });

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Cet épisode ne fait pas partie de cette saison"
        );
    });

    it("rejects with a 400 when the episode has no air date yet", async () => {
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: null });

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Cet épisode n'est pas encore diffusé"
        );
    });

    it("rejects with a 409 when the episode is already recorded for this viewing", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });
        userEpisodeRepoMocks.existsForViewing.mockResolvedValue(true);

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Cet épisode a déjà été visionné pour ce visionnage"
        );
        expect(userEpisodeRepoMocks.create).not.toHaveBeenCalled();
    });

    it("creates the viewing when everything checks out", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });

        await expect(episodeService.addViewing("user-1", 7, 1)).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.create).toHaveBeenCalledWith("user-1", 7, 1, expect.any(String));
    });

    it("throws a 500 when creation fails", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });
        userEpisodeRepoMocks.create.mockResolvedValue(false);

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Impossible d'ajouter le visionnage"
        );
    });
});

describe("EpisodeService.updateViewing", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when id or watchedAt is missing", async () => {
        await expect(episodeService.updateViewing("user-1", undefined, "2024-01-01")).rejects.toThrow(
            "Requête invalide"
        );
        await expect(episodeService.updateViewing("user-1", 5, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the date is in the future", async () => {
        const future = new Date(Date.now() + 86400000).toISOString();

        await expect(episodeService.updateViewing("user-1", 5, future)).rejects.toThrow(
            "Date de visionnage invalide"
        );
    });

    it("updates the viewing when valid", async () => {
        userEpisodeRepoMocks.updateWatchedAt.mockResolvedValue(true);

        await expect(episodeService.updateViewing("user-1", 5, "2024-01-01")).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.updateWatchedAt).toHaveBeenCalledWith("user-1", 5, "2024-01-01");
    });

    it("throws a 500 when nothing was updated", async () => {
        userEpisodeRepoMocks.updateWatchedAt.mockResolvedValue(false);

        await expect(episodeService.updateViewing("user-1", 5, "2024-01-01")).rejects.toThrow(
            "Impossible de modifier le visionnage"
        );
    });
});

describe("EpisodeService.deleteViewing", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when no id is given", async () => {
        await expect(episodeService.deleteViewing("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("deletes the viewing when it exists", async () => {
        userEpisodeRepoMocks.deleteById.mockResolvedValue(true);

        await expect(episodeService.deleteViewing("user-1", 5)).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.deleteById).toHaveBeenCalledWith("user-1", 5);
    });

    it("throws a 500 when nothing was deleted", async () => {
        userEpisodeRepoMocks.deleteById.mockResolvedValue(false);

        await expect(episodeService.deleteViewing("user-1", 5)).rejects.toThrow(
            "Impossible de supprimer le visionnage"
        );
    });
});

describe("EpisodeService.backfillForUser", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("does nothing when the user has no tracked seasons", async () => {
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([]);

        await episodeService.backfillForUser("user-1");

        expect(userEpisodeRepoMocks.createIfMissing).not.toHaveBeenCalled();
    });

    it("backfills every already-aired episode of every tracked viewing", async () => {
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([
            { id: 7, showId: 42, number: 1, addedAt: "2023-05-01" },
        ]);
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1, date: past },
            { id: 2, date: past },
        ]);

        await episodeService.backfillForUser("user-1");

        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("user-1", 7, 1, "2023-05-01");
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("user-1", 7, 2, "2023-05-01");
    });

    it("skips episodes that haven't aired yet", async () => {
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([
            { id: 7, showId: 42, number: 1, addedAt: "2023-05-01" },
        ]);
        const future = new Date(Date.now() + 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1, date: null },
            { id: 2, date: future },
        ]);

        await episodeService.backfillForUser("user-1");

        expect(userEpisodeRepoMocks.createIfMissing).not.toHaveBeenCalled();
    });

    it("fetches and stores episodes from BetaSeries when none exist locally yet", async () => {
        userSeasonRepoMocks.getUserSeasonsByUserId.mockResolvedValue([
            { id: 7, showId: 42, number: 1, addedAt: "2023-05-01" },
        ]);
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 1, date: past }]);
        searchServiceMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1, title: "Pilot", code: "S01E01", global: 1, number: 1, length: 45, date: past },
        ]);

        await episodeService.backfillForUser("user-1");

        expect(episodeRepoMocks.upsertEpisode).toHaveBeenCalledWith(
            1, 42, 1, 1, "Pilot", "S01E01", 1, 45, past
        );
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("user-1", 7, 1, "2023-05-01");
    });
});
