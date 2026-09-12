import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import PlaylistRepository from "./playlistRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("PlaylistRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("returns the created Playlist", async () => {
        db.query.mockResolvedValue({rows: [{id: "p1", user_id: "user-1", name: "My playlist", created_at: "2024-01-01", visible: true}]});

        const result = await repo.create("user-1", "My playlist", true);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO playlists"), ["user-1", "My playlist", true]);
        expect(result).toEqual({id: "p1", userId: "user-1", name: "My playlist", createdAt: "2024-01-01", visible: true, showsCount: undefined, posters: undefined});
    });
});

describe("PlaylistRepository.getById", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("returns a Playlist when found", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{id: "p1", user_id: "user-1", name: "My playlist", created_at: "2024-01-01", visible: true}]});

        const result = await repo.getById("p1");

        expect(result.id).toBe("p1");
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getById("unknown");

        expect(result).toBeNull();
    });
});

describe("PlaylistRepository.getCountByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("returns the parsed count", async () => {
        db.query.mockResolvedValue({rows: [{total: "3"}]});

        const result = await repo.getCountByUserId("user-1");

        expect(result).toBe(3);
    });

    it("returns 0 when total is missing", async () => {
        db.query.mockResolvedValue({rows: [{total: undefined}]});

        const result = await repo.getCountByUserId("user-1");

        expect(result).toBe(0);
    });
});

describe("PlaylistRepository.getByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("maps rows to Playlist instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "p1", user_id: "user-1", name: "My playlist", created_at: "2024-01-01", visible: true, shows_count: "2", posters: ["a.png"]}]});

        const result = await repo.getByUserId("user-1");

        expect(result).toEqual([{id: "p1", userId: "user-1", name: "My playlist", createdAt: "2024-01-01", visible: true, showsCount: 2, posters: ["a.png"]}]);
    });
});

describe("PlaylistRepository.getVisibleByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("maps rows to Playlist instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "p1", user_id: "user-1", name: "My playlist", created_at: "2024-01-01", visible: true, shows_count: "0", posters: []}]});

        const result = await repo.getVisibleByUserId("user-1");

        expect(result).toEqual([{id: "p1", userId: "user-1", name: "My playlist", createdAt: "2024-01-01", visible: true, showsCount: 0, posters: []}]);
    });
});

describe("PlaylistRepository.update", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("returns true when the playlist was updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.update("p1", {name: "New name", visible: false});

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE playlists"), ["p1", "New name", false]);
        expect(result).toBe(true);
    });

    it("defaults missing fields to null", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.update("p1", {});

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["p1", null, null]);
    });
});

describe("PlaylistRepository.delete", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("returns true when the playlist was deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.delete("p1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM playlists"), ["p1"]);
        expect(result).toBe(true);
    });

    it("returns false when no matching playlist existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.delete("unknown");

        expect(result).toBe(false);
    });
});

describe("PlaylistRepository.addShow", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("calls the insert query with the playlist and show ids", async () => {
        db.query.mockResolvedValue({});

        await repo.addShow("p1", 10);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO playlists_shows"), ["p1", 10]);
    });
});

describe("PlaylistRepository.removeShow", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("returns true when a row was removed", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.removeShow("p1", 10);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM playlists_shows"), ["p1", 10]);
        expect(result).toBe(true);
    });

    it("returns false when nothing matched", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.removeShow("p1", 999);

        expect(result).toBe(false);
    });
});

describe("PlaylistRepository.getShowsByPlaylistId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new PlaylistRepository();
    });

    it("maps rows to Show instances", async () => {
        db.query.mockResolvedValue({
            rows: [{id: 10, title: "Show", poster: "poster.png", kind_names: ["Drame"], duration: 42, seasons: 1, country: "FR", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8}],
        });

        const result = await repo.getShowsByPlaylistId("p1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM shows"), ["p1"]);
        expect(result).toEqual([{id: 10, title: "Show", poster: "poster.png", kinds: ["Drame"], duration: 42, seasons: 1, country: "FR", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8}]);
    });
});
