import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import KindRepository from "./kindRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("KindRepository.getKinds", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new KindRepository();
    });

    it("maps rows (id -> value) to Kind instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "Drama", name: "Drame"}]});

        const result = await repo.getKinds();

        expect(result).toEqual([{value: "Drama", name: "Drame"}]);
    });
});

describe("KindRepository.upsertKind", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new KindRepository();
    });

    it("returns true when a row was inserted or updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.upsertKind("Drama", "Drame");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO kinds"), ["Drama", "Drame"]);
        expect(result).toBe(true);
    });

    it("returns false when nothing was written", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.upsertKind("Drama", "Drame");

        expect(result).toBe(false);
    });
});
