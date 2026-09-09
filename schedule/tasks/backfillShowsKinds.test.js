import {describe, it, expect, vi, beforeEach} from "vitest";
import backfillShowsKinds from "./backfillShowsKinds.js";

const showRepoMocks = vi.hoisted(() => ({
    getAllShows: vi.fn(),
    setKinds: vi.fn(),
}));
const kindRepoMocks = vi.hoisted(() => ({
    getKinds: vi.fn(),
}));

vi.mock("../../repositories/showRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return showRepoMocks; }),
}));
vi.mock("../../repositories/kindRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return kindRepoMocks; }),
}));

describe("backfillShowsKinds", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        kindRepoMocks.getKinds.mockResolvedValue([
            {value: "Drama", name: "Drame"},
            {value: "Crime", name: "Policier"},
        ]);
        showRepoMocks.setKinds.mockResolvedValue(undefined);
    });

    it("resolves each legacy display name to its kind id and syncs shows_kinds", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([
            {id: 42, title: "Breaking Bad", kinds: "Drame;Policier"},
        ]);

        const result = await backfillShowsKinds();

        expect(showRepoMocks.setKinds).toHaveBeenCalledWith(42, ["Drama", "Crime"]);
        expect(result).toEqual({updated: 1, total: 1, orphanNames: [], failed: []});
    });

    it("reports names that don't match any known kind instead of dropping them silently", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([
            {id: 42, title: "Breaking Bad", kinds: "Drame;Inconnu"},
        ]);

        const result = await backfillShowsKinds();

        expect(showRepoMocks.setKinds).toHaveBeenCalledWith(42, ["Drama"]);
        expect(result.orphanNames).toEqual(["Inconnu"]);
    });

    it("skips a show entirely when none of its names resolve", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([
            {id: 42, title: "Breaking Bad", kinds: "Inconnu"},
        ]);

        const result = await backfillShowsKinds();

        expect(showRepoMocks.setKinds).not.toHaveBeenCalled();
        expect(result).toEqual({updated: 0, total: 1, orphanNames: ["Inconnu"], failed: []});
    });

    it("handles a show with an empty kinds string", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([
            {id: 42, title: "Breaking Bad", kinds: ""},
        ]);

        const result = await backfillShowsKinds();

        expect(showRepoMocks.setKinds).not.toHaveBeenCalled();
        expect(result).toEqual({updated: 0, total: 1, orphanNames: [], failed: []});
    });

    it("reports a failure without aborting the other shows", async () => {
        showRepoMocks.getAllShows.mockResolvedValue([
            {id: 42, title: "Breaking Bad", kinds: "Drame"},
            {id: 99, title: "Other Show", kinds: "Policier"},
        ]);
        showRepoMocks.setKinds.mockImplementation(async (id) => {
            if (id === 42) throw new Error("db down");
        });

        const result = await backfillShowsKinds();

        expect(result.updated).toEqual(1);
        expect(result.failed).toEqual([{id: 42, title: "Breaking Bad", error: "db down"}]);
    });
});
