import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import NoteRepository from "./noteRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("NoteRepository.getNotes", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new NoteRepository();
    });

    it("maps rows to Note instances", async () => {
        db.query.mockResolvedValue({rows: [{id: 1, name: "Chef d'oeuvre"}, {id: 2, name: "Excellent"}]});

        const result = await repo.getNotes();

        expect(result).toEqual([{id: 1, name: "Chef d'oeuvre"}, {id: 2, name: "Excellent"}]);
    });

    it("returns an empty array when there are no notes", async () => {
        db.query.mockResolvedValue({rows: []});

        const result = await repo.getNotes();

        expect(result).toEqual([]);
    });
});
