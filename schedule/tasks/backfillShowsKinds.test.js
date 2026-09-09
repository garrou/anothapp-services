import {describe, it, expect, vi, beforeEach} from "vitest";

const dbMocks = vi.hoisted(() => ({
    query: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("../../config/db.js", () => ({default: dbMocks}));

const {default: backfillShowsKinds} = await import("./backfillShowsKinds.js");

const kindsRows = [
    {id: "Drama", name: "Drame"},
    {id: "Crime", name: "Policier"},
];

describe("backfillShowsKinds", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbMocks.transaction.mockImplementation(async (callback) => {
            const client = {query: vi.fn().mockResolvedValue({})};
            return callback(client);
        });
    });

    it("resolves each legacy display name to its kind id and syncs shows_kinds", async () => {
        dbMocks.query
            .mockResolvedValueOnce({rows: kindsRows})
            .mockResolvedValueOnce({rows: [{id: 42, title: "Breaking Bad", kinds: "Drame;Policier"}]});

        const result = await backfillShowsKinds();

        expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
        expect(result).toEqual({updated: 1, total: 1, orphanNames: [], failed: []});
    });

    it("reports names that don't match any known kind instead of dropping them silently", async () => {
        dbMocks.query
            .mockResolvedValueOnce({rows: kindsRows})
            .mockResolvedValueOnce({rows: [{id: 42, title: "Breaking Bad", kinds: "Drame;Inconnu"}]});

        const result = await backfillShowsKinds();

        expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
        expect(result.orphanNames).toEqual(["Inconnu"]);
    });

    it("skips a show entirely when none of its names resolve", async () => {
        dbMocks.query
            .mockResolvedValueOnce({rows: kindsRows})
            .mockResolvedValueOnce({rows: [{id: 42, title: "Breaking Bad", kinds: "Inconnu"}]});

        const result = await backfillShowsKinds();

        expect(dbMocks.transaction).not.toHaveBeenCalled();
        expect(result).toEqual({updated: 0, total: 1, orphanNames: ["Inconnu"], failed: []});
    });

    it("handles a show with an empty kinds string", async () => {
        dbMocks.query
            .mockResolvedValueOnce({rows: kindsRows})
            .mockResolvedValueOnce({rows: [{id: 42, title: "Breaking Bad", kinds: ""}]});

        const result = await backfillShowsKinds();

        expect(dbMocks.transaction).not.toHaveBeenCalled();
        expect(result).toEqual({updated: 0, total: 1, orphanNames: [], failed: []});
    });

    it("reports a failure without aborting the other shows", async () => {
        dbMocks.query
            .mockResolvedValueOnce({rows: kindsRows})
            .mockResolvedValueOnce({rows: [
                {id: 42, title: "Breaking Bad", kinds: "Drame"},
                {id: 99, title: "Other Show", kinds: "Policier"},
            ]});
        dbMocks.transaction.mockImplementation(async (callback) => {
            const client = {
                query: vi.fn().mockImplementation(async (sql, params) => {
                    if (sql.includes("INSERT") && params[0] === 42) {
                        throw new Error("db down");
                    }
                    return {};
                }),
            };
            return callback(client);
        });

        const result = await backfillShowsKinds();

        expect(result.updated).toEqual(1);
        expect(result.failed).toEqual([{id: 42, title: "Breaking Bad", error: "db down"}]);
    });
});
