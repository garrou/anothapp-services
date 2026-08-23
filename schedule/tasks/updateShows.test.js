import {describe, it, expect, vi, beforeEach} from "vitest";
import updateShows from "./updateShows.js";

const showRepoMocks = vi.hoisted(() => ({
    getAllShows: vi.fn(),
    updateShow: vi.fn(),
    deleteShow: vi.fn(),
}));
const betaseriesMocks = vi.hoisted(() => ({
    fetchShow: vi.fn(),
    fetchNextEpisodeDate: vi.fn(),
    fetchSeasons: vi.fn(),
}));

vi.mock("../../repositories/showRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return showRepoMocks; }),
}));
vi.mock("../lib/betaseries.js", () => ({default: betaseriesMocks}));

const dbShow = {
    id: 42,
    title: "Breaking Bad",
    poster: "https://img/old.jpg",
    kinds: "Drame;Policier",
    duration: 45,
    seasons: 5,
    country: "US",
    finished: false,
    next_episode: "2024-01-01",
};

const unchangedApiShow = {
    genres: {28: "Drame", 80: "Policier"},
    images: {poster: "https://img/old.jpg"},
    status: "Running",
    length: "45",
    country: "US",
};

describe("updateShows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        betaseriesMocks.fetchNextEpisodeDate.mockResolvedValue("2024-01-01");
        betaseriesMocks.fetchSeasons.mockResolvedValue([1, 2, 3, 4, 5]);
    });

    it("does nothing when the show is unchanged", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue(unchangedApiShow);

        const result = await updateShows();

        expect(result).toEqual({updated: [], toDelete: [], failed: []});
        expect(showRepoMocks.updateShow).not.toHaveBeenCalled();
        expect(showRepoMocks.deleteShow).not.toHaveBeenCalled();
    });

    it("treats the same genres in a different order as unchanged", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([{...dbShow, kinds: "Policier;Drame"}]);
        betaseriesMocks.fetchShow.mockResolvedValue(unchangedApiShow); // computes "Drame;Policier"

        const result = await updateShows();

        expect(result).toEqual({updated: [], toDelete: [], failed: []});
        expect(showRepoMocks.updateShow).not.toHaveBeenCalled();
    });

    it("updates a show whose kinds changed", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...unchangedApiShow,
            genres: {28: "Drame", 10765: "Science-Fiction"},
        });

        const result = await updateShows();

        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            kinds: "Drame;Science-Fiction",
        }));
        expect(result.updated).toEqual([dbShow]);
    });

    it("updates a show whose poster changed", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...unchangedApiShow,
            images: {poster: "https://img/new.jpg"},
        });

        const result = await updateShows();

        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            poster: "https://img/new.jpg",
            deleted: false,
        }));
        expect(result.updated).toEqual([dbShow]);
    });

    it("syncs the season count against fetchSeasons(), not the display endpoint's own count", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue(unchangedApiShow);
        betaseriesMocks.fetchSeasons.mockResolvedValue([1, 2, 3, 4, 5, 6]);

        const result = await updateShows();

        expect(betaseriesMocks.fetchSeasons).toHaveBeenCalledWith(42);
        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({seasons: 6}));
        expect(result.updated).toEqual([dbShow]);
    });

    it("flags a show that no longer exists on BetaSeries instead of deleting it", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue(null);

        const result = await updateShows();

        expect(showRepoMocks.deleteShow).not.toHaveBeenCalled();
        expect(showRepoMocks.updateShow).not.toHaveBeenCalled();
        expect(result.toDelete).toEqual([dbShow]);
    });

    it("does not fetch the next episode when the show is finished, and clears it", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...unchangedApiShow,
            status: "Ended",
        });

        const result = await updateShows();

        expect(betaseriesMocks.fetchNextEpisodeDate).not.toHaveBeenCalled();
        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            finished: true,
            nextEpisode: "",
        }));
        expect(result.updated).toEqual([dbShow]);
    });

    it("keeps the existing duration and country when BetaSeries returns empty values", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...unchangedApiShow,
            images: {poster: "https://img/new.jpg"},
            length: "0",
            country: "",
        });

        await updateShows();

        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            duration: dbShow.duration,
            country: dbShow.country,
        }));
    });

    it("reports a failure without aborting the other shows", async () => {
        const otherShow = {...dbShow, id: 99, title: "Other Show"};
        showRepoMocks.getAllShows.mockResolvedValue([dbShow, otherShow]);
        betaseriesMocks.fetchShow.mockImplementation(async (id) => {
            if (id === 42) throw new Error("network down");
            return unchangedApiShow;
        });

        const result = await updateShows();

        expect(result.failed).toEqual([{id: 42, title: "Breaking Bad", error: "network down"}]);
        expect(showRepoMocks.updateShow).not.toHaveBeenCalled();
        expect(showRepoMocks.deleteShow).not.toHaveBeenCalled();
    });
});
