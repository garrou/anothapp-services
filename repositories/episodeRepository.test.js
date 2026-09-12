import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import EpisodeRepository from "./episodeRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("EpisodeRepository.getEpisodesByShowIdBySeason", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new EpisodeRepository();
    });

    it("maps rows to Episode instances", async () => {
        db.query.mockResolvedValue({
            rows: [{id: 1, show_id: 10, season_number: 1, number: 1, title: "Pilot", code: "S01E01", global: 1, length: 42, date: "2020-01-01", description: "desc"}],
        });

        const result = await repo.getEpisodesByShowIdBySeason(10, 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM episodes"), [10, 1]);
        expect(result).toEqual([{id: 1, showId: 10, seasonNumber: 1, number: 1, title: "Pilot", code: "S01E01", global: 1, length: 42, date: "2020-01-01", description: "desc"}]);
    });
});

describe("EpisodeRepository.getEpisodeById", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new EpisodeRepository();
    });

    it("returns an Episode when found", async () => {
        db.query.mockResolvedValue({
            rowCount: 1,
            rows: [{id: 1, show_id: 10, season_number: 1, number: 1, title: "Pilot", code: "S01E01", global: 1, length: 42, date: "2020-01-01", description: "desc"}],
        });

        const result = await repo.getEpisodeById(1);

        expect(result).toEqual({id: 1, showId: 10, seasonNumber: 1, number: 1, title: "Pilot", code: "S01E01", global: 1, length: 42, date: "2020-01-01", description: "desc"});
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getEpisodeById(999);

        expect(result).toBeNull();
    });
});

describe("EpisodeRepository.upsertEpisode", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new EpisodeRepository();
    });

    it("returns true when a row was inserted or updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.upsertEpisode(1, 10, 1, 1, "Pilot", "S01E01", 1, 42, "2020-01-01", "desc");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO episodes"), [1, 10, 1, 1, "Pilot", "S01E01", 1, 42, "2020-01-01", "desc"]);
        expect(result).toBe(true);
    });

    it("defaults missing date/description to null", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.upsertEpisode(1, 10, 1, 1, "Pilot", "S01E01", 1, 42, undefined, undefined);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [1, 10, 1, 1, "Pilot", "S01E01", 1, 42, null, null]);
    });
});

describe("EpisodeRepository.getAllEpisodeSeasons", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new EpisodeRepository();
    });

    it("returns the distinct show/season rows", async () => {
        db.query.mockResolvedValue({rows: [{show_id: 10, season_number: 1}]});

        const result = await repo.getAllEpisodeSeasons();

        expect(result).toEqual([{show_id: 10, season_number: 1}]);
    });
});

describe("EpisodeRepository.deleteEpisodesNotIn", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new EpisodeRepository();
    });

    it("returns the number of deleted rows", async () => {
        db.query.mockResolvedValue({rowCount: 3});

        const result = await repo.deleteEpisodesNotIn(10, 1, [1, 2]);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM episodes"), [10, 1, [1, 2]]);
        expect(result).toBe(3);
    });
});
