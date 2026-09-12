import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import DatabaseRepository from "./databaseRepository.js";

vi.mock("../config/db.js", () => ({
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
