import {describe, it, expect, vi, beforeEach} from "vitest";
import axios from "axios";
import SearchService from "./searchService.js";

vi.mock("axios", () => ({default: {get: vi.fn()}}));

const platformRepoMocks = vi.hoisted(() => ({getPlatforms: vi.fn()}));
const noteRepoMocks = vi.hoisted(() => ({getNotes: vi.fn()}));
const kindRepoMocks = vi.hoisted(() => ({getKinds: vi.fn()}));

vi.mock("../repositories/platformRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return platformRepoMocks; }),
}));
vi.mock("../repositories/noteRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return noteRepoMocks; }),
}));
vi.mock("../repositories/kindRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return kindRepoMocks; }),
}));

describe("SearchService", () => {
    let service;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SearchService();
    });

    describe("getShows", () => {
        it("fetches from the discover endpoint when no filter is given", async () => {
            axios.get.mockResolvedValue({data: {shows: [{id: 1, title: "Show", images: {}, length: "0", seasons: "1", episodes: "1", genres: {}}]}});

            const result = await service.getShows(undefined, undefined, undefined, undefined, undefined);

            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/shows/discover"), expect.any(Object));
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(1);
        });

        it("fetches from the search endpoint when a filter is given", async () => {
            axios.get.mockResolvedValue({data: {shows: [{id: 1, title: "Show", poster: "poster.png", svods: []}]}});

            const result = await service.getShows("Show", undefined, undefined, undefined, undefined);

            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/search/shows"), expect.any(Object));
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("text=Show"), expect.any(Object));
            expect(result[0].title).toBe("Show");
        });
    });

    describe("getImages", () => {
        it("returns the poster of each discovered show", async () => {
            axios.get.mockResolvedValue({data: {shows: [{id: 1, title: "Show", images: {poster: "poster.png"}}]}});

            const result = await service.getImages(undefined);

            expect(result).toEqual(["poster.png"]);
        });
    });

    describe("getByShowId", () => {
        it("throws when id is missing", async () => {
            await expect(service.getByShowId(undefined)).rejects.toMatchObject({status: 400});
            expect(axios.get).not.toHaveBeenCalled();
        });

        it("returns an ApiShow for a valid id", async () => {
            axios.get.mockResolvedValue({data: {show: {id: 10, title: "Show", images: {}, length: "42", seasons: "1", episodes: "8", genres: {}}}});

            const result = await service.getByShowId(10);

            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/shows/display?id=10"), expect.any(Object));
            expect(result.id).toBe(10);
            expect(result.duration).toBe(42);
        });
    });

    describe("getSeasonsByShowId", () => {
        it("throws when id is missing", async () => {
            await expect(service.getSeasonsByShowId(undefined)).rejects.toMatchObject({status: 400});
        });

        it("maps seasons with cumulated episode intervals", async () => {
            axios.get.mockResolvedValue({data: {seasons: [{number: 1, episodes: 8, image: "img1.png"}, {number: 2, episodes: 10, image: "img2.png"}]}});

            const result = await service.getSeasonsByShowId(10);

            expect(result).toEqual([
                {number: 1, episodes: 8, image: "img1.png", interval: "1 - 8"},
                {number: 2, episodes: 10, image: "img2.png", interval: "9 - 18"},
            ]);
        });
    });

    describe("getSeasonByShowIdByNumber", () => {
        it("throws when id or num is missing", async () => {
            await expect(service.getSeasonByShowIdByNumber(10, undefined)).rejects.toMatchObject({status: 400});
            await expect(service.getSeasonByShowIdByNumber(undefined, 1)).rejects.toMatchObject({status: 400});
        });

        it("returns the matching season", async () => {
            axios.get.mockResolvedValue({data: {seasons: [{number: 1, episodes: 8, image: "img.png"}, {number: 2, episodes: 10, image: "img2.png"}]}});

            const result = await service.getSeasonByShowIdByNumber(10, 2);

            expect(result.number).toBe(2);
        });

        it("returns null when no season matches", async () => {
            axios.get.mockResolvedValue({data: {seasons: [{number: 1, episodes: 8, image: "img.png"}]}});

            const result = await service.getSeasonByShowIdByNumber(10, 99);

            expect(result).toBeNull();
        });
    });

    describe("getEpisodesByShowIdBySeason", () => {
        it("throws when id or num is missing", async () => {
            await expect(service.getEpisodesByShowIdBySeason(undefined, 1)).rejects.toMatchObject({status: 400});
        });

        it("maps episodes to ApiEpisode instances", async () => {
            axios.get.mockResolvedValue({data: {episodes: [{id: 1, title: "Pilot", code: "S01E01", episode: 1}]}});

            const result = await service.getEpisodesByShowIdBySeason(10, 1);

            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/shows/episodes?id=10&season=1"), expect.any(Object));
            expect(result[0].id).toBe(1);
            expect(result[0].number).toBe(1);
        });
    });

    describe("getCharactersByShowId", () => {
        it("throws when id is missing", async () => {
            await expect(service.getCharactersByShowId(undefined)).rejects.toMatchObject({status: 400});
        });

        it("maps characters to ApiCharacter instances", async () => {
            axios.get.mockResolvedValue({data: {characters: [{person_id: "5", name: "Character", actor: "Actor", picture: "pic.png"}]}});

            const result = await service.getCharactersByShowId(10);

            expect(result).toEqual([{id: 5, name: "Character", actor: "Actor", picture: "pic.png"}]);
        });
    });

    describe("getSimilarsByShowId", () => {
        it("throws when id is missing", async () => {
            await expect(service.getSimilarsByShowId(undefined)).rejects.toMatchObject({status: 400});
        });

        it("maps similars to ApiEntity instances", async () => {
            axios.get.mockResolvedValue({data: {similars: [{show_id: 20, show_title: "Other Show"}]}});

            const result = await service.getSimilarsByShowId(10);

            expect(result).toEqual([{id: 20, title: "Other Show"}]);
        });
    });

    describe("getKinds", () => {
        it("delegates to the kind repository", async () => {
            kindRepoMocks.getKinds.mockResolvedValue([{value: "Drama", name: "Drame"}]);

            const result = await service.getKinds();

            expect(result).toEqual([{value: "Drama", name: "Drame"}]);
        });
    });

    describe("getImagesByShowId", () => {
        it("throws when id is missing", async () => {
            await expect(service.getImagesByShowId(undefined)).rejects.toMatchObject({status: 400});
        });

        it("returns the picture urls", async () => {
            axios.get.mockResolvedValue({data: {pictures: [{url: "a.png"}, {url: "b.png"}]}});

            const result = await service.getImagesByShowId(10);

            expect(result).toEqual(["a.png", "b.png"]);
        });
    });

    describe("getPersonById", () => {
        it("throws when id is missing", async () => {
            await expect(service.getPersonById(undefined)).rejects.toMatchObject({status: 400});
        });

        it("returns an ApiPerson", async () => {
            axios.get.mockResolvedValue({data: {person: {id: "5", name: "Actor", shows: []}}});

            const result = await service.getPersonById(5);

            expect(result.id).toBe(5);
            expect(result.name).toBe("Actor");
        });
    });

    describe("getPlatforms", () => {
        it("delegates to the platform repository", async () => {
            platformRepoMocks.getPlatforms.mockResolvedValue([{id: 1, name: "Netflix"}]);

            const result = await service.getPlatforms();

            expect(result).toEqual([{id: 1, name: "Netflix"}]);
        });
    });

    describe("getNotes", () => {
        it("delegates to the note repository", async () => {
            noteRepoMocks.getNotes.mockResolvedValue([{id: 1, name: "Excellent"}]);

            const result = await service.getNotes();

            expect(result).toEqual([{id: 1, name: "Excellent"}]);
        });
    });
});
