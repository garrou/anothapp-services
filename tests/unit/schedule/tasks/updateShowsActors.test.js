import {describe, it, expect, vi, beforeEach} from "vitest";
import updateShowsActors from "../../../../schedule/tasks/updateShowsActors.js";

const showRepoMocks = vi.hoisted(() => ({
    getShowIdsNeedingCastSync: vi.fn(),
    setCast: vi.fn(),
}));
const betaseriesMocks = vi.hoisted(() => ({
    fetchCharacters: vi.fn(),
}));

vi.mock("../../../../repositories/showRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return showRepoMocks; }),
}));
vi.mock("../../../../schedule/lib/betaseries.js", () => ({default: betaseriesMocks}));

const cast = [{id: 34100, actor: "Rami Malek", picture: "rami.jpg"}];

describe("updateShowsActors", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        showRepoMocks.setCast.mockResolvedValue(undefined);
    });

    it("does nothing when every show already has a synced cast", async () => {
        showRepoMocks.getShowIdsNeedingCastSync.mockResolvedValue([]);

        const result = await updateShowsActors();

        expect(betaseriesMocks.fetchCharacters).not.toHaveBeenCalled();
        expect(result).toEqual({processed: 0, failed: []});
    });

    it("fetches and persists the cast for each show needing a sync", async () => {
        showRepoMocks.getShowIdsNeedingCastSync.mockResolvedValue([1, 2]);
        betaseriesMocks.fetchCharacters.mockResolvedValue(cast);

        const result = await updateShowsActors();

        expect(betaseriesMocks.fetchCharacters).toHaveBeenCalledWith(1);
        expect(betaseriesMocks.fetchCharacters).toHaveBeenCalledWith(2);
        expect(showRepoMocks.setCast).toHaveBeenCalledWith(1, cast);
        expect(showRepoMocks.setCast).toHaveBeenCalledWith(2, cast);
        expect(result).toEqual({processed: 2, failed: []});
    });

    it("reports a failure without aborting the other shows", async () => {
        showRepoMocks.getShowIdsNeedingCastSync.mockResolvedValue([1, 2]);
        betaseriesMocks.fetchCharacters.mockImplementation(async (id) => {
            if (id === 1) throw new Error("network down");
            return cast;
        });

        const result = await updateShowsActors();

        expect(result.failed).toEqual([{id: 1, error: "network down"}]);
        expect(result.processed).toBe(1);
    });
});
