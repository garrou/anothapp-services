import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import DatabaseRepository from "../../../repositories/databaseRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("DatabaseRepository.getDatabaseSize", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new DatabaseRepository();
    });

    it("returns the formatted size from the query", async () => {
        db.query.mockResolvedValue({rows: [{size: "128 MB"}]});

        const result = await repo.getDatabaseSize();

        expect(result).toBe("128 MB");
    });
});

describe("DatabaseRepository.getDatabaseSizeBytes", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new DatabaseRepository();
    });

    it("returns the raw size in bytes as a number", async () => {
        db.query.mockResolvedValue({rows: [{size: "134217728"}]});

        const result = await repo.getDatabaseSizeBytes();

        expect(result).toBe(134217728);
    });
});

describe("DatabaseRepository.recordSizeSnapshot", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new DatabaseRepository();
    });

    it("inserts a snapshot row with the given size", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.recordSizeSnapshot(134217728);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO database_size_history"), [134217728]);
    });
});

describe("DatabaseRepository.getSizeHistory", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new DatabaseRepository();
    });

    it("returns snapshots oldest first", async () => {
        db.query.mockResolvedValue({
            rows: [
                {recorded_at: "2024-01-08", size_bytes: "200"},
                {recorded_at: "2024-01-01", size_bytes: "100"},
            ],
        });

        const result = await repo.getSizeHistory();

        expect(result).toEqual([
            {recordedAt: "2024-01-01", sizeBytes: 100},
            {recordedAt: "2024-01-08", sizeBytes: 200},
        ]);
    });

    it("defaults the limit to 52 snapshots", async () => {
        db.query.mockResolvedValue({rows: []});

        await repo.getSizeHistory();

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [52]);
    });
});
