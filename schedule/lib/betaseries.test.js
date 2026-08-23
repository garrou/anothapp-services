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
