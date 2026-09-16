import { describe, it, expect } from "vitest";
import DatabaseRepository from "../../../repositories/databaseRepository.js";

describe("DatabaseRepository (real Postgres)", () => {
    it("returns the database size in a human-readable pg_size_pretty format", async () => {
        const repo = new DatabaseRepository();

        const result = await repo.getDatabaseSize();

        expect(result).toMatch(/^\d+(\.\d+)?\s?(bytes|kB|MB|GB)$/);
    });
});
