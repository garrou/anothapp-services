import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import reportCatalogSize from "../../../../schedule/tasks/reportCatalogSize.js";

const catalogRepoMocks = vi.hoisted(() => ({
    getCounts: vi.fn(),
    recordSizeSnapshot: vi.fn(),
}));

vi.mock("../../../../repositories/catalogRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return catalogRepoMocks; }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    catalogRepoMocks.getCounts.mockResolvedValue({shows: 42, seasons: 100, episodes: 2000});
});

afterEach(() => {
    vi.useRealTimers();
});

describe("reportCatalogSize", () => {
    it("returns the current counts", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-02")); // a Tuesday

        const result = await reportCatalogSize();

        expect(result.shows).toBe(42);
        expect(result.seasons).toBe(100);
        expect(result.episodes).toBe(2000);
    });

    it("records a history snapshot on the sync day and reports it", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01")); // a Monday

        const result = await reportCatalogSize();

        expect(catalogRepoMocks.recordSizeSnapshot).toHaveBeenCalledWith({shows: 42, seasons: 100, episodes: 2000});
        expect(result).toEqual({shows: 42, seasons: 100, episodes: 2000, historyRecorded: true});
    });

    it("skips the history snapshot on any other day", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-02")); // a Tuesday

        const result = await reportCatalogSize();

        expect(catalogRepoMocks.recordSizeSnapshot).not.toHaveBeenCalled();
        expect(result.historyRecorded).toBe(false);
    });
});
