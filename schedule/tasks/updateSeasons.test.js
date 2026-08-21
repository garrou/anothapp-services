import {describe, it, expect, vi, beforeEach} from "vitest";
import updateSeasons from "./updateSeasons.js";

const seasonRepoMocks = vi.hoisted(() => ({
    getAllSeasons: vi.fn(),
    updateSeasonEpisodesImage: vi.fn(),
    deleteSeasonByShowIdByNumber: vi.fn(),
    fillMissingSeasonImages: vi.fn(),
}));
const betaseriesMocks = vi.hoisted(() => ({
    fetchSeasons: vi.fn(),
}));

vi.mock("../../repositories/seasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return seasonRepoMocks; }),
}));
vi.mock("../lib/betaseries.js", () => ({default: betaseriesMocks}));

describe("updateSeasons", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        seasonRepoMocks.fillMissingSeasonImages.mockResolvedValue(0);
    });

    it("does nothing when every season is unchanged", async () => {
        seasonRepoMocks.getAllSeasons.mockResolvedValue([
            {show_id: 1, number: 1, episodes: 10, image: "poster.jpg"},
        ]);
        betaseriesMocks.fetchSeasons.mockResolvedValue([
            {number: 1, episodes: 10, image: "poster.jpg"},
        ]);

        const result = await updateSeasons();

        expect(result).toEqual({updated: [], deleted: [], failed: []});
        expect(seasonRepoMocks.updateSeasonEpisodesImage).not.toHaveBeenCalled();
        expect(seasonRepoMocks.deleteSeasonByShowIdByNumber).not.toHaveBeenCalled();
        expect(seasonRepoMocks.fillMissingSeasonImages).toHaveBeenCalledOnce();
    });

    it("updates a season whose episode count changed", async () => {
        seasonRepoMocks.getAllSeasons.mockResolvedValue([
            {show_id: 1, number: 1, episodes: 10, image: "poster.jpg"},
        ]);
        betaseriesMocks.fetchSeasons.mockResolvedValue([
            {number: 1, episodes: 12, image: "poster.jpg"},
        ]);

        const result = await updateSeasons();

        expect(seasonRepoMocks.updateSeasonEpisodesImage).toHaveBeenCalledWith(1, 1, 12, "poster.jpg");
        expect(result.updated).toEqual([{showId: 1, number: 1, episodes: 12, image: "poster.jpg"}]);
    });

    it("ignores an empty image from the API instead of overwriting the current one", async () => {
        seasonRepoMocks.getAllSeasons.mockResolvedValue([
            {show_id: 1, number: 1, episodes: 10, image: "poster.jpg"},
        ]);
        betaseriesMocks.fetchSeasons.mockResolvedValue([
            {number: 1, episodes: 12, image: ""},
        ]);

        await updateSeasons();

        expect(seasonRepoMocks.updateSeasonEpisodesImage).toHaveBeenCalledWith(1, 1, 12, "");
    });

    it("deletes a season number that no longer exists on BetaSeries", async () => {
        seasonRepoMocks.getAllSeasons.mockResolvedValue([
            {show_id: 1, number: 1, episodes: 10, image: "poster.jpg"},
            {show_id: 1, number: 2, episodes: 8, image: "poster.jpg"},
        ]);
        betaseriesMocks.fetchSeasons.mockResolvedValue([
            {number: 1, episodes: 10, image: "poster.jpg"},
        ]);

        const result = await updateSeasons();

        expect(seasonRepoMocks.deleteSeasonByShowIdByNumber).toHaveBeenCalledWith(1, 2);
        expect(result.deleted).toEqual([{show_id: 1, number: 2, episodes: 8, image: "poster.jpg"}]);
    });

    it("fetches a show's seasons only once no matter how many season rows it has", async () => {
        seasonRepoMocks.getAllSeasons.mockResolvedValue([
            {show_id: 1, number: 1, episodes: 10, image: "poster.jpg"},
            {show_id: 1, number: 2, episodes: 8, image: "poster.jpg"},
            {show_id: 1, number: 3, episodes: 6, image: "poster.jpg"},
        ]);
        betaseriesMocks.fetchSeasons.mockResolvedValue([
            {number: 1, episodes: 10, image: "poster.jpg"},
            {number: 2, episodes: 8, image: "poster.jpg"},
            {number: 3, episodes: 6, image: "poster.jpg"},
        ]);

        await updateSeasons();

        expect(betaseriesMocks.fetchSeasons).toHaveBeenCalledOnce();
        expect(betaseriesMocks.fetchSeasons).toHaveBeenCalledWith(1);
    });

    it("reports a failure for one show's seasons without aborting the others", async () => {
        seasonRepoMocks.getAllSeasons.mockResolvedValue([
            {show_id: 1, number: 1, episodes: 10, image: "poster.jpg"},
            {show_id: 2, number: 1, episodes: 5, image: "poster.jpg"},
        ]);
        betaseriesMocks.fetchSeasons.mockImplementation(async (showId) => {
            if (showId === 1) throw new Error("network down");
            return [{number: 1, episodes: 7, image: "poster.jpg"}];
        });

        const result = await updateSeasons();

        expect(result.failed).toEqual([{showId: 1, error: "network down"}]);
        expect(result.updated).toEqual([{showId: 2, number: 1, episodes: 7, image: "poster.jpg"}]);
    });
});
