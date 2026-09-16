import { describe, it, expect } from "vitest";
import NoteRepository from "./noteRepository.js";

describe("NoteRepository (real Postgres)", () => {
    it("returns every seeded note ordered by id", async () => {
        const repo = new NoteRepository();

        const result = await repo.getNotes();

        expect(result).toEqual([
            { id: 1, name: "Nul" },
            { id: 2, name: "Moyen" },
            { id: 3, name: "Bien" },
            { id: 4, name: "Très bien" },
            { id: 5, name: "Excellent" },
        ]);
    });
});
