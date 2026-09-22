import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import ShowService from "../../../services/showService.js";
import SeasonService from "../../../services/seasonService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

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

        it("ends the friend's live watch-together relation but keeps the owner's historical tag when the friend deletes their whole show", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [ownerId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(ownerId, showId);
            const ownerSeasonId = await insertUserSeason(ownerId, showId, 1);
            const seasonService = new SeasonService();
            seasonService._showService._searchService.getByShowId = async () => { throw new Error("should not be called"); };
            seasonService._showService._searchService.getSeasonByShowIdByNumber = async () => { throw new Error("should not be called"); };
            await seasonService.updateWatchedWith(ownerId, ownerSeasonId, [friendId]);
            await seasonService.respondToWatchedWith(friendId, ownerSeasonId, true);

            await service.deleteByShowId(friendId, showId, "false");

            const friendShow = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [friendId, showId]);
            expect(friendShow.rowCount).toBe(0);
            const relation = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1`, [ownerSeasonId]);
            expect(relation.rowCount).toBe(0);
            const tag = await db.query(`
                SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2
            `, [ownerSeasonId, friendId]);
            expect(tag.rows[0]["status_id"]).toBe("accepted");
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

    describe("ensureSeasonTracked", () => {
        it("reuses an existing viewing instead of creating a duplicate", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const existingId = await insertUserSeason(userId, showId, 1);

            const result = await service.ensureSeasonTracked(userId, showId, 1, 999);

            expect(result).toBe(existingId);
            const res = await db.query(`SELECT COUNT(*) AS total FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [userId, showId]);
            expect(parseInt(res.rows[0].total)).toBe(1);
        });

        it("adds the show and season, copying the given platform, when the user has neither yet", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);

            const result = await service.ensureSeasonTracked(userId, showId, 1, 2);

            const show = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
            expect(show.rowCount).toBe(1);
            const season = await db.query(`SELECT id, platform_id FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [userId, showId]);
            expect(season.rows[0].id).toBe(result);
            expect(season.rows[0]["platform_id"]).toBe(2);
        });

        it("never creates two viewings when called concurrently for the same user/show/season (real advisory lock, real pool connections)", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);

            const results = await Promise.all(
                Array.from({ length: 5 }, () => service.ensureSeasonTracked(userId, showId, 1, 999))
            );

            expect(new Set(results).size).toBe(1);
            const res = await db.query(`SELECT COUNT(*) AS total FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [userId, showId]);
            expect(parseInt(res.rows[0].total)).toBe(1);
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
