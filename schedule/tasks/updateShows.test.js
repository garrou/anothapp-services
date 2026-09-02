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

const apiShow = {
    genres: {28: "Drame", 80: "Policier"},
    images: {poster: "https://img/old.jpg"},
    status: "Running",
    length: "45",
    country: "US",
    description: "Un prof de chimie se lance dans la méth.",
    creation: "2008",
    network: "AMC",
    language: "en",
    episodes: "62",
};

describe("updateShows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        showRepoMocks.updateShow.mockResolvedValue(true);
        betaseriesMocks.fetchNextEpisodeDate.mockResolvedValue("2024-01-01");
        betaseriesMocks.fetchSeasons.mockResolvedValue([1, 2, 3, 4, 5]);
    });

    it("updates every show on every run, unconditionally", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue(apiShow);

        const result = await updateShows();

        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, {
            deleted: false,
            poster: "https://img/old.jpg",
            kinds: "Drame;Policier",
            duration: 45,
            seasons: 5,
            country: "US",
            finished: false,
            nextEpisode: "2024-01-01",
            description: "Un prof de chimie se lance dans la méth.",
            creation: 2008,
            network: "AMC",
            language: "en",
            episodes: 62,
        });
        expect(result).toEqual({updated: 1, toDelete: [], failed: []});
    });

    it("passes through the new metadata fields (description, creation, network, language, episodes)", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...apiShow,
            description: "Nouveau synopsis",
            creation: "2010",
            network: "Netflix",
            language: "fr",
            episodes: "10",
        });

        await updateShows();

        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            description: "Nouveau synopsis",
            creation: 2010,
            network: "Netflix",
            language: "fr",
            episodes: 10,
        }));
    });

    it("keeps the existing metadata fields when BetaSeries doesn't return them", async () => {
        const dbShowWithMetadata = {
            ...dbShow,
            description: "Ancien synopsis",
            creation: 2008,
            network: "AMC",
            language: "en",
            episodes: 62,
        };
        showRepoMocks.getAllShows.mockResolvedValue([dbShowWithMetadata]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...apiShow,
            description: undefined,
            creation: undefined,
            network: undefined,
            language: undefined,
            episodes: undefined,
        });

        await updateShows();

        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            description: "Ancien synopsis",
            creation: 2008,
            network: "AMC",
            language: "en",
            episodes: 62,
        }));
    });

    it("nulls out the new metadata fields when neither BetaSeries nor the existing row has them", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...apiShow,
            description: undefined,
            creation: undefined,
            network: undefined,
            language: undefined,
            episodes: undefined,
        });

        await updateShows();

        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            description: null,
            creation: null,
            network: null,
            language: null,
            episodes: null,
        }));
    });

    it("syncs the season count against fetchSeasons(), not the display endpoint's own count", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue(apiShow);
        betaseriesMocks.fetchSeasons.mockResolvedValue([1, 2, 3, 4, 5, 6]);

        const result = await updateShows();

        expect(betaseriesMocks.fetchSeasons).toHaveBeenCalledWith(42);
        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({seasons: 6}));
        expect(result.updated).toEqual(1);
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
            ...apiShow,
            status: "Ended",
        });

        const result = await updateShows();

        expect(betaseriesMocks.fetchNextEpisodeDate).not.toHaveBeenCalled();
        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(42, expect.objectContaining({
            finished: true,
            nextEpisode: "",
        }));
        expect(result.updated).toEqual(1);
    });

    it("keeps the existing duration and country when BetaSeries returns empty values", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([dbShow]);
        betaseriesMocks.fetchShow.mockResolvedValue({
            ...apiShow,
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
            return apiShow;
        });

        const result = await updateShows();

        expect(result.failed).toEqual([{id: 42, title: "Breaking Bad", error: "network down"}]);
        expect(result.updated).toEqual(1);
        expect(showRepoMocks.updateShow).toHaveBeenCalledWith(99, expect.objectContaining({deleted: false}));
        expect(showRepoMocks.deleteShow).not.toHaveBeenCalled();
    });
});
