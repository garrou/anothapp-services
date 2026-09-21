import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import ShowService from "../../../services/showService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow } from "../fixtures.js";

describe("ShowService (real Postgres)", () => {
    /** @type {ShowService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new ShowService();
        // getByShowId/getSeasonByShowIdByNumber hit the real Betaseries API - stub them so only
        // the DB paths are real. Individual tests that need the "unknown locally" path override these.
        service._searchService.getByShowId = async () => { throw new Error("should not be called"); };
        service._searchService.getSeasonByShowIdByNumber = async () => { throw new Error("should not be called"); };
    });

    describe("ensureShowExists", () => {
        it("returns the show as-is when it is already known locally", async () => {
            const showId = await insertShow({ title: "Known" });

            const result = await service.ensureShowExists(showId);

            expect(result.title).toBe("Known");
        });

        it("fetches and persists the show when it is not known locally yet", async () => {
            service._searchService.getByShowId = async (id) => ({
                id, title: "Fetched Show", poster: "p.jpg", kinds: ["Drame"], kindsById: [{ id: "Drama", name: "Drame" }],
                duration: 30, seasons: 1, country: "US", description: null, creation: 2020,
                network: null, language: "en", episodes: 10,
            });

            const result = await service.ensureShowExists(999999);

            expect(result.title).toBe("Fetched Show");
            const res = await db.query(`SELECT title FROM shows WHERE id = 999999`);
            expect(res.rows[0].title).toBe("Fetched Show");
        });
    });

    describe("addShow", () => {
        it("adds a known show to the user's collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            await service.addShow(userId, showId, false);

            const res = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
            expect(res.rowCount).toBe(1);
        });

        it("adds to the watchlist instead when addInList is true", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            await service.addShow(userId, showId, true);

            const list = await db.query(`SELECT * FROM users_list WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
            expect(list.rowCount).toBe(1);
        });

        it("rejects adding the same show twice", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await service.addShow(userId, showId, false);

            await expect(service.addShow(userId, showId, false)).rejects.toMatchObject({ status: 409 });
        });

        it("rejects without a show id", async () => {
            const userId = await insertUser();

            await expect(service.addShow(userId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("deleteByShowId", () => {
        it("removes the show from the collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await service.addShow(userId, showId, false);

            await service.deleteByShowId(userId, showId, "false");

            const res = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
            expect(res.rowCount).toBe(0);
        });

        it("throws when the show isn't there to delete", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            await expect(service.deleteByShowId(userId, showId, "false")).rejects.toMatchObject({ status: 500 });
        });
    });

    describe("getShowById", () => {
        it("returns watch time and distinct episode count", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId);

            const result = await service.getShowById(userId, showId);

            expect(result.serie.id).toBe(showId);
            expect(result.time).toBe(0);
            expect(result.distinctEpisodes).toBe(0);
        });

        it("throws 404 when the show is not in the user's collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            await expect(service.getShowById(userId, showId)).rejects.toMatchObject({ status: 404 });
        });
    });

    describe("addSeason", () => {
        it("adds an already-known season without needing the external API", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId);
            await insertSeason(showId, 1);

            await service.addSeason(userId, showId, 1);

            const res = await db.query(`SELECT * FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [userId, showId]);
            expect(res.rowCount).toBe(1);
        });

        it("fetches and creates the season when it is not known locally yet", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId);
            service._searchService.getSeasonByShowIdByNumber = async () => ({ number: 1, episodes: 8, image: "s1.jpg" });

            await service.addSeason(userId, showId, 1);

            const season = await db.query(`SELECT episodes FROM seasons WHERE show_id = $1 AND number = 1`, [showId]);
            expect(season.rows[0].episodes).toBe(8);
        });

        it("rejects when the show is not in the user's collection", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            await expect(service.addSeason(userId, showId, 1)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateByShowId", () => {
        it("toggles favorite", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId, { favorite: false });

            const result = await service.updateByShowId(userId, showId, { favorite: true });

            expect(result).toBe(true);
        });

        it("rejects an addedAt date in the future", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertUserShow(userId, showId);

            await expect(service.updateByShowId(userId, showId, { addedAt: "2999-01-01" }))
                .rejects.toMatchObject({ status: 400 });
        });

        it("rejects when no known field is given", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            await expect(service.updateByShowId(userId, showId, {})).rejects.toMatchObject({ status: 400 });
        });
    });
});
