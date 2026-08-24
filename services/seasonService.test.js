import { describe, it, expect, vi, beforeEach } from "vitest";
import SeasonService from "./seasonService.js";

const seasonRepoMocks = vi.hoisted(() => ({
    deleteSeasonById: vi.fn(),
    updateSeason: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getViewedByMonthAgo: vi.fn(),
    getSeasonsByAddedYear: vi.fn(),
}));
const episodeServiceMocks = vi.hoisted(() => ({
    getByUserSeasonId: vi.fn(),
    addViewing: vi.fn(),
    updatePlatformForSeason: vi.fn(),
}));

vi.mock("../repositories/seasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return seasonRepoMocks; }),
}));
vi.mock("../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("./episodeService.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeServiceMocks; }),
}));

describe("SeasonService.deleteBySeasonId", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("rejects with a 400 when no seasonId is given", async () => {
        await expect(seasonService.deleteBySeasonId("user-1", undefined)).rejects.toThrow(
            "Requête invalide"
        );
        expect(seasonRepoMocks.deleteSeasonById).not.toHaveBeenCalled();
    });

    it("deletes the season when it exists", async () => {
        seasonRepoMocks.deleteSeasonById.mockResolvedValue(true);

        await expect(seasonService.deleteBySeasonId("user-1", 7)).resolves.toBeUndefined();
        expect(seasonRepoMocks.deleteSeasonById).toHaveBeenCalledWith("user-1", 7);
    });

    it("throws a 500 when nothing was deleted", async () => {
        seasonRepoMocks.deleteSeasonById.mockResolvedValue(false);

        await expect(seasonService.deleteBySeasonId("user-1", 7)).rejects.toThrow(
            "Impossible de supprimer la saison"
        );
    });
});

describe("SeasonService.getEpisodesBySeasonId", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("delegates to EpisodeService.getByUserSeasonId", async () => {
        episodeServiceMocks.getByUserSeasonId.mockResolvedValue(["episode-checklist"]);

        const result = await seasonService.getEpisodesBySeasonId("user-1", 7);

        expect(result).toEqual(["episode-checklist"]);
        expect(episodeServiceMocks.getByUserSeasonId).toHaveBeenCalledWith("user-1", 7);
    });
});

describe("SeasonService.addEpisodeViewing", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("delegates to EpisodeService.addViewing", async () => {
        await seasonService.addEpisodeViewing("user-1", 7, 100);

        expect(episodeServiceMocks.addViewing).toHaveBeenCalledWith("user-1", 7, 100);
    });
});

describe("SeasonService.getSeasons", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("delegates to getViewedByMonthAgo when month matches one of the accepted string values", async () => {
        userSeasonRepoMocks.getViewedByMonthAgo.mockResolvedValue(["recent-season"]);

        const result = await seasonService.getSeasons("user-1", undefined, "1");

        expect(result).toEqual(["recent-season"]);
        expect(userSeasonRepoMocks.getViewedByMonthAgo).toHaveBeenCalledWith("user-1", "1");
    });

    it("accepts every documented month shortcut value", async () => {
        userSeasonRepoMocks.getViewedByMonthAgo.mockResolvedValue([]);

        for (const month of ["0", "1", "2", "3", "6", "12"]) {
            await expect(seasonService.getSeasons("user-1", undefined, month)).resolves.toEqual([]);
        }
    });

    it("does NOT match month passed as a number, since MONTHS holds strings (falls through)", async () => {
        // documents current behavior: month=1 (number) isn't found in MONTHS
        // (array of strings), so with no year it ends up rejected as invalid
        await expect(seasonService.getSeasons("user-1", undefined, 1)).rejects.toThrow(
            "Requête invalide"
        );
        expect(userSeasonRepoMocks.getViewedByMonthAgo).not.toHaveBeenCalled();
    });

    it("falls back to getSeasonsByAddedYear when a year is given and month doesn't match", async () => {
        userSeasonRepoMocks.getSeasonsByAddedYear.mockResolvedValue(["season-2024"]);

        const result = await seasonService.getSeasons("user-1", 2024, undefined);

        expect(result).toEqual(["season-2024"]);
        expect(userSeasonRepoMocks.getSeasonsByAddedYear).toHaveBeenCalledWith("user-1", 2024);
    });

    it("rejects with a 400 when neither a valid month nor a year is given", async () => {
        await expect(seasonService.getSeasons("user-1", undefined, undefined)).rejects.toThrow(
            "Requête invalide"
        );
    });
});

describe("SeasonService.updateBySeasonId", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("rejects with a 400 when seasonId is missing", async () => {
        await expect(
            seasonService.updateBySeasonId("user-1", undefined, 2, "2024-01-01")
        ).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when platformId is missing", async () => {
        await expect(
            seasonService.updateBySeasonId("user-1", 7, undefined, "2024-01-01")
        ).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when viewedAt is missing", async () => {
        await expect(
            seasonService.updateBySeasonId("user-1", 7, 2, undefined)
        ).rejects.toThrow("Requête invalide");
    });

    it("updates the season and cascades the platform onto its episodes", async () => {
        seasonRepoMocks.updateSeason.mockResolvedValue(true);

        await expect(
            seasonService.updateBySeasonId("user-1", 7, 2, "2024-01-01")
        ).resolves.toBeUndefined();
        expect(seasonRepoMocks.updateSeason).toHaveBeenCalledWith("user-1", 7, 2, "2024-01-01");
        expect(episodeServiceMocks.updatePlatformForSeason).toHaveBeenCalledWith("user-1", 7, 2);
    });

    it("throws a 500 when the update fails in the database", async () => {
        seasonRepoMocks.updateSeason.mockResolvedValue(false);

        await expect(
            seasonService.updateBySeasonId("user-1", 7, 2, "2024-01-01")
        ).rejects.toThrow("Impossible de modifier la saison");
        expect(episodeServiceMocks.updatePlatformForSeason).not.toHaveBeenCalled();
    });
});