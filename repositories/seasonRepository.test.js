import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import SeasonRepository from "./seasonRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("SeasonRepository.deleteSeasonById", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns true when a row was deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.deleteSeasonById("user-1", 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM users_seasons"), [1, "user-1"]);
        expect(result).toBe(true);
    });

    it("returns false when no matching row existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.deleteSeasonById("user-1", 999);

        expect(result).toBe(false);
    });
});

describe("SeasonRepository.getSeasonByShowIdByNumber", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns a Season when found", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{show_id: 10, number: 1, episodes: 8, image: "img.png"}]});

        const result = await repo.getSeasonByShowIdByNumber(10, 1);

        expect(result).toEqual({number: 1, episodes: 8, image: "img.png", interval: ""});
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getSeasonByShowIdByNumber(10, 99);

        expect(result).toBeNull();
    });
});

describe("SeasonRepository.createSeason", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns true when the season was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.createSeason(8, 1, "img.png", 10);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO seasons"), [8, 1, "img.png", 10]);
        expect(result).toBe(true);
    });
});

describe("SeasonRepository.updateSeason", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns true when a row was updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.updateSeason("user-1", 1, 2, "2024-01-01");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users_seasons"), [2, 1, "user-1", "2024-01-01"]);
        expect(result).toBe(true);
    });

    it("returns false when no matching row existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.updateSeason("user-1", 999, 2, "2024-01-01");

        expect(result).toBe(false);
    });
});

describe("SeasonRepository.getAllSeasons", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns the raw rows", async () => {
        db.query.mockResolvedValue({rows: [{number: 1, episodes: 8, image: "img.png", show_id: 10}]});

        const result = await repo.getAllSeasons();

        expect(result).toEqual([{number: 1, episodes: 8, image: "img.png", show_id: 10}]);
    });
});

describe("SeasonRepository.updateSeasonEpisodesImage", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns true when a row was updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.updateSeasonEpisodesImage(10, 1, 8, "img.png");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE seasons"), [10, 1, 8, "img.png"]);
        expect(result).toBe(true);
    });

    it("returns false when no matching row existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.updateSeasonEpisodesImage(999, 1, 8, "img.png");

        expect(result).toBe(false);
    });
});

describe("SeasonRepository.deleteSeasonByShowIdByNumber", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns true when a row was deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.deleteSeasonByShowIdByNumber(10, 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM seasons"), [10, 1]);
        expect(result).toBe(true);
    });

    it("returns false when no matching row existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.deleteSeasonByShowIdByNumber(999, 1);

        expect(result).toBe(false);
    });
});

describe("SeasonRepository.fillMissingSeasonImages", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new SeasonRepository();
    });

    it("returns the number of rows updated", async () => {
        db.query.mockResolvedValue({rowCount: 4});

        const result = await repo.fillMissingSeasonImages();

        expect(result).toBe(4);
    });
});
