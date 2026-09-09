import {describe, it, expect, vi, beforeEach} from "vitest";
import reportDatabaseSize from "./reportDatabaseSize.js";

const databaseRepoMocks = vi.hoisted(() => ({
    getDatabaseSize: vi.fn(),
}));

vi.mock("../../repositories/databaseRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return databaseRepoMocks; }),
}));

describe("reportDatabaseSize", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the database size", async () => {
        databaseRepoMocks.getDatabaseSize.mockResolvedValue("128 MB");

        const result = await reportDatabaseSize();

        expect(result).toEqual({size: "128 MB"});
    });
});
