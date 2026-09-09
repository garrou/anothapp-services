import {describe, it, expect, vi, beforeEach} from "vitest";
import updateKinds from "./updateKinds.js";

const kindRepoMocks = vi.hoisted(() => ({
    upsertKind: vi.fn(),
}));
const betaseriesMocks = vi.hoisted(() => ({
    fetchGenres: vi.fn(),
}));

vi.mock("../../repositories/kindRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return kindRepoMocks; }),
}));
vi.mock("../lib/betaseries.js", () => ({default: betaseriesMocks}));

describe("updateKinds", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("upserts every genre returned by BetaSeries", async () => {
        betaseriesMocks.fetchGenres.mockResolvedValue([
            {id: "action", name: "Action"},
            {id: "drama", name: "Drame"},
        ]);
        kindRepoMocks.upsertKind.mockResolvedValue(true);

        const result = await updateKinds();

        expect(kindRepoMocks.upsertKind).toHaveBeenCalledWith("action", "Action");
        expect(kindRepoMocks.upsertKind).toHaveBeenCalledWith("drama", "Drame");
        expect(result).toEqual({upserted: 2, failed: []});
    });

    it("reports a failure without aborting the other genres", async () => {
        betaseriesMocks.fetchGenres.mockResolvedValue([
            {id: "action", name: "Action"},
            {id: "drama", name: "Drame"},
        ]);
        kindRepoMocks.upsertKind.mockImplementation(async (id) => {
            if (id === "action") throw new Error("db down");
            return true;
        });

        const result = await updateKinds();

        expect(result.upserted).toEqual(1);
        expect(result.failed).toEqual([{id: "action", name: "Action", error: "db down"}]);
    });
});
