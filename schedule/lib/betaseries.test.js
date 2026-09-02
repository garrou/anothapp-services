import {describe, it, expect, vi, beforeEach} from "vitest";

const clientMocks = vi.hoisted(() => ({
    get: vi.fn(),
}));

vi.mock("../../helpers/betaseriesClient.js", () => ({
    default: vi.fn().mockImplementation(function () { return clientMocks; }),
}));

const {default: betaseries} = await import("./betaseries.js");

describe("fetchSeasons caching", () => {
    beforeEach(() => {
        clientMocks.get.mockReset();
    });

    it("reuses the result for the same show id instead of calling the API again", async () => {
        clientMocks.get.mockResolvedValue({seasons: [{number: 1}, {number: 2}]});

        const first = await betaseries.fetchSeasons(101);
        const second = await betaseries.fetchSeasons(101);

        expect(first).toEqual([{number: 1}, {number: 2}]);
        expect(second).toBe(first);
        expect(clientMocks.get).toHaveBeenCalledOnce();
    });

    it("fetches independently for different show ids", async () => {
        clientMocks.get.mockResolvedValue({seasons: [{number: 1}]});

        await betaseries.fetchSeasons(102);
        await betaseries.fetchSeasons(103);

        expect(clientMocks.get).toHaveBeenCalledTimes(2);
        expect(clientMocks.get).toHaveBeenCalledWith("/shows/seasons?id=102");
        expect(clientMocks.get).toHaveBeenCalledWith("/shows/seasons?id=103");
    });
});

describe("fetchPerson", () => {
    beforeEach(() => {
        clientMocks.get.mockReset();
    });

    it("returns the person object", async () => {
        clientMocks.get.mockResolvedValue({person: {id: 34100, name: "Rami Malek"}});

        const person = await betaseries.fetchPerson(34100);

        expect(person).toEqual({id: 34100, name: "Rami Malek"});
        expect(clientMocks.get).toHaveBeenCalledWith("/persons/person?id=34100");
    });

    it("returns null when BetaSeries returns an empty array instead of a person", async () => {
        clientMocks.get.mockResolvedValue({person: []});

        const person = await betaseries.fetchPerson(34100);

        expect(person).toBeNull();
    });
});
