import { describe, it, expect, beforeEach } from "vitest";
import EpisodeRepository from "../../../repositories/episodeRepository.js";
import { resetDb } from "../resetDb.js";
import { insertShow, insertSeason, insertEpisode } from "../fixtures.js";

describe("EpisodeRepository (real Postgres)", () => {
    /** @type {EpisodeRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new EpisodeRepository();
    });

    describe("getEpisodesByShowIdBySeason", () => {
        it("returns the season's episodes ordered by number", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertEpisode(showId, 1, { id: 1, number: 2 });
            await insertEpisode(showId, 1, { id: 2, number: 1 });

            const result = await repo.getEpisodesByShowIdBySeason(showId, 1);

            expect(result.map((e) => e.number)).toEqual([1, 2]);
        });

        it("returns an empty array when the season has no episodes", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1);

            const result = await repo.getEpisodesByShowIdBySeason(showId, 1);

            expect(result).toEqual([]);
        });
    });

    describe("getEpisodeById", () => {
        it("returns the episode", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1);
            const episodeId = await insertEpisode(showId, 1, { title: "Pilot" });

            const result = await repo.getEpisodeById(episodeId);

            expect(result.title).toBe("Pilot");
            expect(result.showId).toBe(showId);
        });

        it("returns null when the episode does not exist", async () => {
            const result = await repo.getEpisodeById(9999);

            expect(result).toBeNull();
        });
    });

    describe("upsertEpisode", () => {
        it("inserts a new episode", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1);

            const result = await repo.upsertEpisode(1, showId, 1, 1, "Pilot", "S01E01", 1, 45, "2020-01-01", "desc");

            expect(result).toBe(true);
            const episode = await repo.getEpisodeById(1);
            expect(episode.title).toBe("Pilot");
        });

        it("updates the episode's mutable fields on conflict, keeping identity fields", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await repo.upsertEpisode(1, showId, 1, 1, "Original", "S01E01", 1, 45, "2020-01-01", "desc");

            const result = await repo.upsertEpisode(1, showId, 1, 1, "Renamed", "S01E01", 1, 50, "2020-02-01", "new desc");

            expect(result).toBe(true);
            const episode = await repo.getEpisodeById(1);
            expect(episode.title).toBe("Renamed");
            expect(episode.length).toBe(50);
        });
    });

    describe("getAllEpisodeSeasons", () => {
        it("returns distinct show/season pairs only for unfinished shows", async () => {
            const ongoingShow = await insertShow({ finished: false });
            await insertSeason(ongoingShow, 1);
            await insertEpisode(ongoingShow, 1, { number: 1 });
            await insertEpisode(ongoingShow, 1, { number: 2 });

            const finishedShow = await insertShow({ finished: true });
            await insertSeason(finishedShow, 1);
            await insertEpisode(finishedShow, 1, { number: 1 });

            const result = await repo.getAllEpisodeSeasons();

            expect(result).toEqual([{ show_id: ongoingShow, season_number: 1 }]);
        });
    });

    describe("deleteEpisodesNotIn", () => {
        it("deletes episodes of the season whose id is not in the given list", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertEpisode(showId, 1, { id: 1, number: 1 });
            await insertEpisode(showId, 1, { id: 2, number: 2 });
            await insertEpisode(showId, 1, { id: 3, number: 3 });

            const result = await repo.deleteEpisodesNotIn(showId, 1, [1, 3]);

            expect(result).toBe(1);
            const remaining = await repo.getEpisodesByShowIdBySeason(showId, 1);
            expect(remaining.map((e) => e.id).sort()).toEqual([1, 3]);
        });
    });
});
