import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import ShowRepository from "./showRepository.js";

vi.mock("../config/db.js", () => ({
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
        client.query.mockResolvedValueOnce({rowCount: 1});

        const result = await repo.createShow(10, "Show", "poster.png", [{id: "Drama", name: "Drame"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("INSERT INTO shows"), [10, "Show", "poster.png", 42, 1, "FR", "desc", 2020, "TF1", "fr", 8]);
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("DELETE FROM shows_kinds"), [10]);
        expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO kinds"), ["Drama", "Drame"]);
        expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("INSERT INTO shows_kinds"), [10, "Drama"]);
        expect(result).toBe(true);
    });

    it("does not sync kinds when the insert did not happen", async () => {
        client.query.mockResolvedValueOnce({rowCount: 0});

        const result = await repo.createShow(10, "Show", "poster.png", [{id: "Drama", name: "Drame"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenCalledTimes(1);
        expect(result).toBe(false);
    });

    it("sorts kinds by id before upserting to keep a consistent lock order", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1});

        await repo.createShow(10, "Show", "poster.png", [{id: "Zeta", name: "Z"}, {id: "Alpha", name: "A"}], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenNthCalledWith(3, expect.any(String), ["Alpha", "A", "Zeta", "Z"]);
    });

    it("skips the kinds upsert entirely when there are no kinds", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1});

        await repo.createShow(10, "Show", "poster.png", [], 42, 1, "FR", "desc", 2020, "TF1", "fr", 8);

        expect(client.query).toHaveBeenCalledTimes(2);
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
        await repo.setKinds(10, [{id: "Drama", name: "Drame"}]);

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("DELETE FROM shows_kinds"), [10]);
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO kinds"), ["Drama", "Drame"]);
        expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO shows_kinds"), [10, "Drama"]);
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
        client.query.mockResolvedValueOnce({rowCount: 1});

        const result = await repo.updateShow(10, {poster: "poster.png", kinds: [{id: "Drama", name: "Drame"}], duration: 42, seasons: 1, country: "FR", finished: false, nextEpisode: "2024-01-01", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8});

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("UPDATE shows"), [10, "poster.png", 42, 1, "FR", false, "2024-01-01", "desc", 2020, "TF1", "fr", 8]);
        expect(client.query).toHaveBeenCalledTimes(4);
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
