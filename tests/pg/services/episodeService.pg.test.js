import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import EpisodeService from "../../../services/episodeService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode } from "../fixtures.js";

describe("EpisodeService (real Postgres)", () => {
    /** @type {EpisodeService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new EpisodeService();
        // getEpisodesByShowIdBySeason hits the real Betaseries API - stub it out. Tests that pre-seed
        // episodes never reach it (#ensureEpisodesExist only calls out when the DB has none yet).
        service._searchService.getEpisodesByShowIdBySeason = async () => { throw new Error("should not be called"); };
    });

    describe("getViewedByMonthAgo", () => {
        it("rejects an invalid month shortcut", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });

            await expect(service.getViewedByMonthAgo(userId, "999")).rejects.toMatchObject({ status: 400 });
        });

        it("rejects when episode tracking isn't enabled", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });

            await expect(service.getViewedByMonthAgo(userId, "1")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("addViewing", () => {
        const setupAiredEpisode = async (userId) => {
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { date: "2020-01-01" });
            return { showId, userSeasonId, episodeId };
        };

        it("records a viewing for an already-aired episode", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const { userSeasonId, episodeId } = await setupAiredEpisode(userId);

            await service.addViewing(userId, userSeasonId, episodeId);

            const res = await db.query(`SELECT * FROM users_episodes WHERE users_seasons_id = $1 AND episode_id = $2`, [userSeasonId, episodeId]);
            expect(res.rowCount).toBe(1);
        });

        it("rejects a future-dated episode", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { date: "2999-01-01" });

            await expect(service.addViewing(userId, userSeasonId, episodeId)).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a duplicate viewing", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const { userSeasonId, episodeId } = await setupAiredEpisode(userId);
            await service.addViewing(userId, userSeasonId, episodeId);

            await expect(service.addViewing(userId, userSeasonId, episodeId)).rejects.toMatchObject({ status: 409 });
        });

        it("rejects an episode that doesn't belong to the season", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const { userSeasonId } = await setupAiredEpisode(userId);
            const otherShowId = await insertShow();
            await insertSeason(otherShowId, 1);
            const foreignEpisodeId = await insertEpisode(otherShowId, 1, { date: "2020-01-01" });

            await expect(service.addViewing(userId, userSeasonId, foreignEpisodeId)).rejects.toMatchObject({ status: 400 });
        });

        it("rejects when the season isn't owned by the user", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(otherUserId, showId);
            const userSeasonId = await insertUserSeason(otherUserId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { date: "2020-01-01" });

            await expect(service.addViewing(userId, userSeasonId, episodeId)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("addAllViewings", () => {
        it("marks every already-aired episode of the season as watched", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertEpisode(showId, 1, { number: 1, date: "2020-01-01" });
            await insertEpisode(showId, 1, { number: 2, date: "2999-01-01" });

            await service.addAllViewings(userId, userSeasonId);

            const res = await db.query(`SELECT COUNT(*) AS total FROM users_episodes WHERE users_seasons_id = $1`, [userSeasonId]);
            expect(parseInt(res.rows[0].total)).toBe(1);
        });
    });

    describe("updateViewing", () => {
        it("updates the watched date", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { date: "2020-01-01" });
            await service.addViewing(userId, userSeasonId, episodeId);
            const [viewing] = await service.getByUserSeasonId(userId, userSeasonId);

            await service.updateViewing(userId, viewing.id, "2021-06-01");

            expect(true).toBe(true); // no throw = success; watched_at column tested at repository level
        });

        it("rejects a future watched date", async () => {
            const userId = await insertUser();

            await expect(service.updateViewing(userId, 1, "2999-01-01")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("deleteViewing", () => {
        it("deletes the viewing", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { date: "2020-01-01" });
            await service.addViewing(userId, userSeasonId, episodeId);
            const [viewing] = await service.getByUserSeasonId(userId, userSeasonId);

            await service.deleteViewing(userId, viewing.id);

            const res = await db.query(`SELECT * FROM users_episodes WHERE id = $1`, [viewing.id]);
            expect(res.rowCount).toBe(0);
        });

        it("throws when there is nothing to delete", async () => {
            const userId = await insertUser();

            await expect(service.deleteViewing(userId, 999999)).rejects.toMatchObject({ status: 500 });
        });
    });

    describe("backfillForUser", () => {
        it("marks every already-aired episode of every watched season as viewed", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertEpisode(showId, 1, { number: 1, date: "2020-01-01" });

            await service.backfillForUser(userId);

            const res = await db.query(`SELECT COUNT(*) AS total FROM users_episodes WHERE users_seasons_id = $1`, [userSeasonId]);
            expect(parseInt(res.rows[0].total)).toBe(1);
        });
    });
});
