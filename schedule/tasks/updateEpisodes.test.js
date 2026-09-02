import {describe, it, expect, vi, beforeEach} from "vitest";
import updateEpisodes from "./updateEpisodes.js";

const episodeRepoMocks = vi.hoisted(() => ({
    getAllEpisodeSeasons: vi.fn(),
    upsertEpisode: vi.fn(),
    deleteEpisodesNotIn: vi.fn(),
}));
const betaseriesMocks = vi.hoisted(() => ({
    fetchEpisodes: vi.fn(),
}));

vi.mock("../../repositories/episodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeRepoMocks; }),
}));
vi.mock("../lib/betaseries.js", () => ({default: betaseriesMocks}));

describe("updateEpisodes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        episodeRepoMocks.deleteEpisodesNotIn.mockResolvedValue(0);
    });

    it("does nothing when there are no synced show/season pairs", async () => {
        episodeRepoMocks.getAllEpisodeSeasons.mockResolvedValue([]);

        const result = await updateEpisodes();

        expect(result).toEqual({synced: 0, deleted: 0, failed: []});
        expect(betaseriesMocks.fetchEpisodes).not.toHaveBeenCalled();
    });

    it("upserts every episode returned by BetaSeries for each show/season pair", async () => {
        episodeRepoMocks.getAllEpisodeSeasons.mockResolvedValue([{show_id: 1, season_number: 1}]);
        betaseriesMocks.fetchEpisodes.mockResolvedValue([
            {id: 10, season: 1, episode: 1, title: "Pilot", code: "S01E01", global: 1, length: 45, date: "2020-01-01", description: "Le pilote."},
            {id: 11, season: 1, episode: 2, title: "Ep 2", code: "S01E02", global: 2, length: 45, date: null, description: null},
        ]);

        const result = await updateEpisodes();

        expect(episodeRepoMocks.upsertEpisode).toHaveBeenCalledWith(
            10, 1, 1, 1, "Pilot", "S01E01", 1, 45, "2020-01-01", "Le pilote."
        );
        expect(episodeRepoMocks.upsertEpisode).toHaveBeenCalledWith(
            11, 1, 1, 2, "Ep 2", "S01E02", 2, 45, null, null
        );
        expect(result.synced).toBe(2);
    });

    it("fetches a show only once even when it has several synced seasons", async () => {
        episodeRepoMocks.getAllEpisodeSeasons.mockResolvedValue([
            {show_id: 1, season_number: 1},
            {show_id: 1, season_number: 2},
        ]);
        betaseriesMocks.fetchEpisodes.mockResolvedValue([
            {id: 10, season: 1, episode: 1, title: "Pilot", code: "S01E01", global: 1, length: 45, date: "2020-01-01"},
            {id: 20, season: 2, episode: 1, title: "S2E1", code: "S02E01", global: 2, length: 45, date: "2021-01-01"},
        ]);

        const result = await updateEpisodes();

        expect(betaseriesMocks.fetchEpisodes).toHaveBeenCalledOnce();
        expect(betaseriesMocks.fetchEpisodes).toHaveBeenCalledWith(1);
        expect(episodeRepoMocks.deleteEpisodesNotIn).toHaveBeenCalledWith(1, 1, [10]);
        expect(episodeRepoMocks.deleteEpisodesNotIn).toHaveBeenCalledWith(1, 2, [20]);
        expect(result.synced).toBe(2);
    });

    it("deletes episodes no longer returned by BetaSeries for that season", async () => {
        episodeRepoMocks.getAllEpisodeSeasons.mockResolvedValue([{show_id: 1, season_number: 1}]);
        betaseriesMocks.fetchEpisodes.mockResolvedValue([
            {id: 10, season: 1, episode: 1, title: "Pilot", code: "S01E01", global: 1, length: 45, date: "2020-01-01"},
        ]);
        episodeRepoMocks.deleteEpisodesNotIn.mockResolvedValue(2);

        const result = await updateEpisodes();

        expect(episodeRepoMocks.deleteEpisodesNotIn).toHaveBeenCalledWith(1, 1, [10]);
        expect(result.deleted).toBe(2);
    });

    it("reports a failure for one show without aborting the others", async () => {
        episodeRepoMocks.getAllEpisodeSeasons.mockResolvedValue([
            {show_id: 1, season_number: 1},
            {show_id: 2, season_number: 1},
        ]);
        betaseriesMocks.fetchEpisodes.mockImplementation(async (showId) => {
            if (showId === 1) throw new Error("network down");
            return [{id: 20, season: 1, episode: 1, title: "Ep", code: "S01E01", global: 1, length: 30, date: "2021-01-01"}];
        });

        const result = await updateEpisodes();

        expect(result.failed).toEqual([{showId: 1, error: "network down"}]);
        expect(result.synced).toBe(1);
    });
});
