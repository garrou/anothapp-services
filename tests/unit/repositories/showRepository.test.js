import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import ShowRepository from "../../../repositories/showRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

const makeClient = () => ({query: vi.fn().mockResolvedValue({rowCount: 1, rows: []})});

describe("ShowRepository.isNewShow", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
    });

    it("returns true when no show exists with this id", async () => {
        db.query.mockResolvedValue({rows: [{total: "0"}]});

        const result = await repo.isNewShow(10);

        expect(result).toBe(true);
    });

    it("returns false when the show already exists", async () => {
        db.query.mockResolvedValue({rows: [{total: "1"}]});

        const result = await repo.isNewShow(10);

        expect(result).toBe(false);
    });
});

describe("ShowRepository.createShow", () => {
    let repo;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
        client = makeClient();
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("inserts the show and syncs its kinds when created", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1}); // INSERT INTO shows
        client.query.mockResolvedValueOnce({rowCount: 0}); // DELETE FROM shows_kinds
        client.query.mockResolvedValueOnce({rows: []}); // SELECT existing kinds by name -> none

        const result = await repo.createShow(10, "Show", "poster.png", [{id: "Drama", name: "Drame"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("INSERT INTO shows"), [10, "Show", "poster.png", 42, 1, "FR", "desc", 2020, "TF1", "fr", 8]);
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("DELETE FROM shows_kinds"), [10]);
        expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining("kinds WHERE name = ANY"), [["Drame"]]);
        expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("INSERT INTO kinds"), ["Drama", "Drame"]);
        expect(client.query).toHaveBeenNthCalledWith(5, expect.stringContaining("INSERT INTO shows_kinds"), [10, "Drama"]);
        expect(result).toBe(true);
    });

    it("does not sync kinds when the insert did not happen", async () => {
        client.query.mockResolvedValueOnce({rowCount: 0});

        const result = await repo.createShow(10, "Show", "poster.png", [{id: "Drama", name: "Drame"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenCalledTimes(1);
        expect(result).toBe(false);
    });

    it("sorts kinds by id before upserting to keep a consistent lock order", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1}); // INSERT INTO shows
        client.query.mockResolvedValueOnce({rowCount: 0}); // DELETE FROM shows_kinds
        client.query.mockResolvedValueOnce({rows: []}); // SELECT existing kinds by name -> none

        await repo.createShow(10, "Show", "poster.png", [{id: "Zeta", name: "Z"}, {id: "Alpha", name: "A"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenNthCalledWith(4, expect.any(String), ["Alpha", "A", "Zeta", "Z"]);
    });

    it("skips the kinds upsert entirely when there are no kinds", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1});

        await repo.createShow(10, "Show", "poster.png", [], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenCalledTimes(2);
    });

    it("reuses an existing kind sharing the same name instead of inserting a new id", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1}); // INSERT INTO shows
        client.query.mockResolvedValueOnce({rowCount: 0}); // DELETE FROM shows_kinds
        client.query.mockResolvedValueOnce({rows: [{id: "Science_Fiction", name: "Science-fiction"}]}); // SELECT existing kinds by name -> found

        await repo.createShow(10, "Show", "poster.png", [{id: "Science Fiction", name: "Science-fiction"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        // no INSERT INTO kinds - the existing "Science_Fiction" id is reused instead of "Science Fiction"
        expect(client.query).toHaveBeenCalledTimes(4);
        expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("INSERT INTO shows_kinds"), [10, "Science_Fiction"]);
    });

    it("only inserts kinds that don't already exist under another id", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1}); // INSERT INTO shows
        client.query.mockResolvedValueOnce({rowCount: 0}); // DELETE FROM shows_kinds
        client.query.mockResolvedValueOnce({rows: [{id: "Science_Fiction", name: "Science-fiction"}]}); // SELECT existing kinds by name

        await repo.createShow(10, "Show", "poster.png", [{id: "Science Fiction", name: "Science-fiction"}, {id: "Drama", name: "Drame"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("INSERT INTO kinds"), ["Drama", "Drame"]);
        expect(client.query).toHaveBeenNthCalledWith(5, expect.stringContaining("INSERT INTO shows_kinds"), [10, "Science_Fiction", "Drama"]);
    });
});

describe("ShowRepository.setKinds", () => {
    let repo;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
        client = makeClient();
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("syncs the kinds for the show", async () => {
        client.query.mockResolvedValueOnce({rowCount: 0}); // DELETE FROM shows_kinds
        client.query.mockResolvedValueOnce({rows: []}); // SELECT existing kinds by name -> none

        await repo.setKinds(10, [{id: "Drama", name: "Drame"}]);

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("DELETE FROM shows_kinds"), [10]);
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("kinds WHERE name = ANY"), [["Drame"]]);
        expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO kinds"), ["Drama", "Drame"]);
        expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("INSERT INTO shows_kinds"), [10, "Drama"]);
    });
});

describe("ShowRepository.getShow", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
    });

    it("returns a Show when found", async () => {
        db.query.mockResolvedValue({
            rowCount: 1,
            rows: [{id: 10, title: "Show", poster: "poster.png", kind_names: ["Drame"], duration: 42, seasons: 1, country: "FR", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8}],
        });

        const result = await repo.getShow(10);

        expect(result).toEqual({id: 10, title: "Show", poster: "poster.png", kinds: ["Drame"], duration: 42, seasons: 1, country: "FR", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8});
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getShow(999);

        expect(result).toBeNull();
    });
});

describe("ShowRepository.getAllShows", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
    });

    it("returns the raw rows", async () => {
        db.query.mockResolvedValue({rows: [{id: 10, title: "Show"}]});

        const result = await repo.getAllShows();

        expect(result).toEqual([{id: 10, title: "Show"}]);
    });
});

describe("ShowRepository.updateShow", () => {
    let repo;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
        client = makeClient();
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("updates the show and syncs its kinds when updated", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1}); // UPDATE shows
        client.query.mockResolvedValueOnce({rowCount: 0}); // DELETE FROM shows_kinds
        client.query.mockResolvedValueOnce({rows: []}); // SELECT existing kinds by name -> none

        const result = await repo.updateShow(10, {poster: "poster.png", kinds: [{id: "Drama", name: "Drame"}], duration: 42, seasons: 1, country: "FR", finished: false, nextEpisode: "2024-01-01", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8});

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("UPDATE shows"), [10, "poster.png", 42, 1, "FR", false, "2024-01-01", "desc", 2020, "TF1", "fr", 8]);
        expect(client.query).toHaveBeenCalledTimes(5);
        expect(result).toBe(true);
    });

    it("defaults missing kinds to an empty array", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1});

        await repo.updateShow(10, {poster: "poster.png", duration: 42, seasons: 1, country: "FR", finished: false, nextEpisode: "2024-01-01", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8});

        expect(client.query).toHaveBeenCalledTimes(2);
    });

    it("does not sync kinds when no matching show existed", async () => {
        client.query.mockResolvedValueOnce({rowCount: 0});

        const result = await repo.updateShow(999, {poster: "poster.png", kinds: [], duration: 42, seasons: 1, country: "FR", finished: false, nextEpisode: "2024-01-01"});

        expect(client.query).toHaveBeenCalledTimes(1);
        expect(result).toBe(false);
    });
});

describe("ShowRepository.needsCastSync", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
    });

    it("returns true when the show exists and has never been synced", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{last_cast_sync_at: null}]});

        expect(await repo.needsCastSync(10)).toBe(true);
    });

    it("returns false when the show was already synced", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{last_cast_sync_at: "2024-01-01T00:00:00.000Z"}]});

        expect(await repo.needsCastSync(10)).toBe(false);
    });

    it("returns false when the show doesn't exist in our catalog", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        expect(await repo.needsCastSync(999)).toBe(false);
    });
});

describe("ShowRepository.getShowIdsNeedingCastSync", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
    });

    it("returns the ids of shows never synced, batched by the given limit", async () => {
        db.query.mockResolvedValue({rows: [{id: 1}, {id: 2}]});

        const result = await repo.getShowIdsNeedingCastSync(100);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("last_cast_sync_at IS NULL"), [100]);
        expect(result).toEqual([1, 2]);
    });
});

describe("ShowRepository.setCast", () => {
    let repo;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
        client = makeClient();
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("replaces the cast, upserts the actors and marks the show as synced", async () => {
        await repo.setCast(10, [{id: 2, actor: "Bob", picture: "bob.jpg"}, {id: 1, actor: "Alice", picture: "alice.jpg"}]);

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("DELETE FROM shows_actors"), [10]);
        // sorted by id before upserting, same deadlock-avoidance reason as #syncKinds
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO actors"), [1, "Alice", "alice.jpg", 2, "Bob", "bob.jpg"]);
        expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO shows_actors"), [10, 1, 2]);
        expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("UPDATE shows"), [10]);
    });

    it("skips the actors/links upsert but still marks the show as synced when the cast is empty", async () => {
        await repo.setCast(10, []);

        expect(client.query).toHaveBeenCalledTimes(2);
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("UPDATE shows"), [10]);
    });

    it("caps the stored cast at MAX_CAST_SIZE", async () => {
        const cast = Array.from({length: 40}, (_, i) => ({id: i + 1, actor: `Actor ${i + 1}`, picture: null}));

        await repo.setCast(10, cast);

        const [, insertedActorIds] = client.query.mock.calls[1];
        expect(insertedActorIds).toHaveLength(30 * 3);
    });
});

describe("ShowRepository.deleteShow", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ShowRepository();
    });

    it("returns true when the show was deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.deleteShow(10);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM shows"), [10]);
        expect(result).toBe(true);
    });

    it("returns false when no matching show existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.deleteShow(999);

        expect(result).toBe(false);
    });
});
