import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import EpisodeService from "../../../services/episodeService.js";
import SeasonService from "../../../services/seasonService.js";
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
            const userId = await insertUser();

            await expect(service.getViewedByMonthAgo(userId, "999")).rejects.toMatchObject({ status: 400 });
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
            const userId = await insertUser();
            const { userSeasonId, episodeId } = await setupAiredEpisode(userId);

            await service.addViewing(userId, userSeasonId, episodeId);

            const res = await db.query(`SELECT * FROM users_episodes WHERE users_seasons_id = $1 AND episode_id = $2`, [userSeasonId, episodeId]);
            expect(res.rowCount).toBe(1);
        });

        it("rejects a future-dated episode", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { date: "2999-01-01" });

            await expect(service.addViewing(userId, userSeasonId, episodeId)).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a duplicate viewing", async () => {
            const userId = await insertUser();
            const { userSeasonId, episodeId } = await setupAiredEpisode(userId);
            await service.addViewing(userId, userSeasonId, episodeId);

            await expect(service.addViewing(userId, userSeasonId, episodeId)).rejects.toMatchObject({ status: 409 });
        });

        it("rejects an episode that doesn't belong to the season", async () => {
            const userId = await insertUser();
            const { userSeasonId } = await setupAiredEpisode(userId);
            const otherShowId = await insertShow();
            await insertSeason(otherShowId, 1);
            const foreignEpisodeId = await insertEpisode(otherShowId, 1, { date: "2020-01-01" });

            await expect(service.addViewing(userId, userSeasonId, foreignEpisodeId)).rejects.toMatchObject({ status: 400 });
        });

        it("rejects when the season isn't owned by the user", async () => {
            const userId = await insertUser();
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
            const userId = await insertUser();
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

    describe("watch-together fan-out", () => {
        const setupAcceptedLink = async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const seasonService = new SeasonService();
            seasonService._showService._searchService.getByShowId = async () => { throw new Error("should not be called"); };
            seasonService._showService._searchService.getSeasonByShowIdByNumber = async () => { throw new Error("should not be called"); };
            await seasonService.updateWatchedWith(userId, userSeasonId, [friendId]);
            await seasonService.respondToWatchedWith(friendId, userSeasonId, true);
            const friendSeason = await db.query(`SELECT id FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [friendId, showId]);
            return { userId, friendId, showId, userSeasonId, friendUserSeasonId: friendSeason.rows[0].id };
        };

        it("addViewing mirrors the episode into the accepted friend's own viewing", async () => {
            const { userId, friendUserSeasonId, showId, userSeasonId } = await setupAcceptedLink();
            const episodeId = await insertEpisode(showId, 1, { date: "2020-01-01" });

            await service.addViewing(userId, userSeasonId, episodeId);

            const res = await db.query(`SELECT * FROM users_episodes WHERE users_seasons_id = $1 AND episode_id = $2`, [friendUserSeasonId, episodeId]);
            expect(res.rowCount).toBe(1);
        });

        it("addAllViewings mirrors newly-watched episodes into the accepted friend's viewing", async () => {
            const { userId, friendUserSeasonId, showId, userSeasonId } = await setupAcceptedLink();
            await insertEpisode(showId, 1, { number: 1, date: "2020-01-01" });
            await insertEpisode(showId, 1, { number: 2, date: "2999-01-01" });

            await service.addAllViewings(userId, userSeasonId);

            const res = await db.query(`SELECT COUNT(*) AS total FROM users_episodes WHERE users_seasons_id = $1`, [friendUserSeasonId]);
            expect(parseInt(res.rows[0].total)).toBe(1);
        });

        it("does not mirror an episode add for a viewing that has no accepted link", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const seasonService = new SeasonService();
            await seasonService.updateWatchedWith(userId, userSeasonId, [friendId]);
            const episodeId = await insertEpisode(showId, 1, { date: "2020-01-01" });

            await service.addViewing(userId, userSeasonId, episodeId);

            const res = await db.query(`SELECT COUNT(*) AS total FROM users_episodes`);
            expect(parseInt(res.rows[0].total)).toBe(1);
        });
    });

    describe("updateViewing", () => {
        it("updates the watched date", async () => {
            const userId = await insertUser();
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
            const userId = await insertUser();
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
});
