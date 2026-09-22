import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import CatalogRepository from "../../../repositories/catalogRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("CatalogRepository.getCounts", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new CatalogRepository();
    });

    it("returns the parsed counts for shows, seasons and episodes", async () => {
        db.query
            .mockResolvedValueOnce({rows: [{total: "42"}]})
            .mockResolvedValueOnce({rows: [{total: "100"}]})
            .mockResolvedValueOnce({rows: [{total: "2000"}]});

        const result = await repo.getCounts();

        expect(result).toEqual({shows: 42, seasons: 100, episodes: 2000});
    });
});

describe("CatalogRepository.recordSizeSnapshot", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new CatalogRepository();
    });

    it("inserts a snapshot row with the given counts", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.recordSizeSnapshot({shows: 42, seasons: 100, episodes: 2000});

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO catalog_size_history"), [42, 100, 2000]
        );
    });
});

describe("CatalogRepository.getSizeHistory", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new CatalogRepository();
    });

    it("returns snapshots oldest first", async () => {
        db.query.mockResolvedValue({
            rows: [
                {recorded_at: "2024-01-08", shows_count: "43", seasons_count: "105", episodes_count: "2050"},
                {recorded_at: "2024-01-01", shows_count: "42", seasons_count: "100", episodes_count: "2000"},
            ],
        });

        const result = await repo.getSizeHistory();

        expect(result).toEqual([
            {recordedAt: "2024-01-01", shows: 42, seasons: 100, episodes: 2000},
            {recordedAt: "2024-01-08", shows: 43, seasons: 105, episodes: 2050},
        ]);
    });

    it("defaults the limit to 52 snapshots", async () => {
        db.query.mockResolvedValue({rows: []});

        await repo.getSizeHistory();

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [52]);
    });
});
