import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import reportDatabaseSize from "../../../../schedule/tasks/reportDatabaseSize.js";

const databaseRepoMocks = vi.hoisted(() => ({
    getDatabaseSize: vi.fn(),
    getDatabaseSizeBytes: vi.fn(),
    recordSizeSnapshot: vi.fn(),
}));

vi.mock("../../../../repositories/databaseRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return databaseRepoMocks; }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    databaseRepoMocks.getDatabaseSize.mockResolvedValue("128 MB");
});

afterEach(() => {
    vi.useRealTimers();
});

describe("reportDatabaseSize", () => {
    it("returns the database size", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-02")); // a Tuesday

        const result = await reportDatabaseSize();

        expect(result.size).toBe("128 MB");
    });

    it("records a history snapshot on the sync day and reports it", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01")); // a Monday
        databaseRepoMocks.getDatabaseSizeBytes.mockResolvedValue(134217728);

        const result = await reportDatabaseSize();

        expect(databaseRepoMocks.recordSizeSnapshot).toHaveBeenCalledWith(134217728);
        expect(result).toEqual({size: "128 MB", historyRecorded: true});
    });

    it("skips the history snapshot on any other day", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-02")); // a Tuesday

        const result = await reportDatabaseSize();

        expect(databaseRepoMocks.getDatabaseSizeBytes).not.toHaveBeenCalled();
        expect(databaseRepoMocks.recordSizeSnapshot).not.toHaveBeenCalled();
        expect(result).toEqual({size: "128 MB", historyRecorded: false});
    });
});
