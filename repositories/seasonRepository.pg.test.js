import { describe, it, expect, beforeEach } from "vitest";
import db from "../config/db.js";
import SeasonRepository from "./seasonRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../tests/pg/fixtures.js";

describe("SeasonRepository (real Postgres)", () => {
    /** @type {SeasonRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new SeasonRepository();
    });

    describe("createSeason / getSeasonByShowIdByNumber", () => {
        it("creates a season and retrieves it", async () => {
            const showId = await insertShow();

            const result = await repo.createSeason(10, 1, "poster.jpg", showId);

            expect(result).toBe(true);
            const season = await repo.getSeasonByShowIdByNumber(showId, 1);
            expect(season).toEqual({ number: 1, episodes: 10, image: "poster.jpg", interval: "" });
        });

        it("returns null when the season does not exist", async () => {
            const showId = await insertShow();

            const result = await repo.getSeasonByShowIdByNumber(showId, 1);

            expect(result).toBeNull();
        });
    });

    describe("deleteSeasonById", () => {
        it("deletes the user's watched season", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            const result = await repo.deleteSeasonById(userId, userSeasonId);

            expect(result).toBe(true);
            const res = await db.query(`SELECT * FROM users_seasons WHERE id = $1`, [userSeasonId]);
            expect(res.rowCount).toBe(0);
        });

        it("does not delete another user's watched season", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(otherUserId, showId);
            const userSeasonId = await insertUserSeason(otherUserId, showId, 1);

            const result = await repo.deleteSeasonById(userId, userSeasonId);

            expect(result).toBe(false);
            const res = await db.query(`SELECT * FROM users_seasons WHERE id = $1`, [userSeasonId]);
            expect(res.rowCount).toBe(1);
        });
    });

    describe("updateSeason", () => {
        it("updates the platform and viewing date of a watched season", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            const result = await repo.updateSeason(userId, userSeasonId, 1, "2024-05-01");

            expect(result).toBe(true);
            const res = await db.query(`SELECT platform_id, added_at FROM users_seasons WHERE id = $1`, [userSeasonId]);
            expect(res.rows[0]["platform_id"]).toBe(1);
        });
    });

    describe("getAllSeasons", () => {
        it("only returns seasons of unfinished shows, ordered by show then number", async () => {
            const ongoingShow = await insertShow({ finished: false });
            await insertSeason(ongoingShow, 2, { episodes: 8 });
            await insertSeason(ongoingShow, 1, { episodes: 10 });

            const finishedShow = await insertShow({ finished: true });
            await insertSeason(finishedShow, 1, { episodes: 5 });

            const result = await repo.getAllSeasons();

            expect(result).toEqual([
                { number: 1, episodes: 10, image: null, show_id: ongoingShow },
                { number: 2, episodes: 8, image: null, show_id: ongoingShow },
            ]);
        });
    });

    describe("updateSeasonEpisodesImage", () => {
        it("updates the episode count and image", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1, { episodes: 5, image: "old.jpg" });

            const result = await repo.updateSeasonEpisodesImage(showId, 1, 12, "new.jpg");

            expect(result).toBe(true);
            const season = await repo.getSeasonByShowIdByNumber(showId, 1);
            expect(season.episodes).toBe(12);
            expect(season.image).toBe("new.jpg");
        });

        it("keeps the current image when given an empty string", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1, { episodes: 5, image: "keepme.jpg" });

            await repo.updateSeasonEpisodesImage(showId, 1, 12, "");

            const season = await repo.getSeasonByShowIdByNumber(showId, 1);
            expect(season.image).toBe("keepme.jpg");
        });
    });

    describe("deleteSeasonByShowIdByNumber", () => {
        it("deletes the season", async () => {
            const showId = await insertShow();
            await insertSeason(showId, 1);

            const result = await repo.deleteSeasonByShowIdByNumber(showId, 1);

            expect(result).toBe(true);
            const season = await repo.getSeasonByShowIdByNumber(showId, 1);
            expect(season).toBeNull();
        });
    });

    describe("fillMissingSeasonImages", () => {
        it("fills seasons with no image from the show's poster", async () => {
            const showId = await insertShow({ poster: "show-poster.jpg" });
            await insertSeason(showId, 1, { image: null });
            await insertSeason(showId, 2, { image: "" });
            await insertSeason(showId, 3, { image: "already-set.jpg" });

            const result = await repo.fillMissingSeasonImages();

            expect(result).toBe(2);
            const s1 = await repo.getSeasonByShowIdByNumber(showId, 1);
            const s3 = await repo.getSeasonByShowIdByNumber(showId, 3);
            expect(s1.image).toBe("show-poster.jpg");
            expect(s3.image).toBe("already-set.jpg");
        });
    });
});
