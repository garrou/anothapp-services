import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import StatService from "../../../services/statService.js";
import { resetDb } from "../resetDb.js";
import {
    insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode,
} from "../fixtures.js";

describe("StatService (real Postgres)", () => {
    /** @type {StatService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new StatService();
    });

    describe("getStats", () => {
        it("aggregates season-level stats for a non-tracking user", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });
            const showId = await insertShow({ duration: 45 });
            await insertSeason(showId, 1, { episodes: 10 });
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1);

            const result = await service.getStats(userId);

            expect(result.nbSeries).toBe(1);
            expect(result.nbSeasons).toBe(1);
            expect(result.episodesHeatmap).toBeUndefined();
        });

        it("aggregates episode-level stats, including the heatmap, for a tracking user", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });
            const showId = await insertShow({ duration: 30 });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1, { length: 30 });
            await insertUserEpisode(userId, userSeasonId, episodeId);

            const result = await service.getStats(userId);

            expect(result.nbEpisodes).toBe(1);
            expect(result.episodesHeatmap).toBeDefined();
        });

        it("rejects fetching a non-friend's stats", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();

            await expect(service.getStats(userId, strangerId)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("getWrapped", () => {
        it("returns the wrapped summary for a given year", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });
            const showId = await insertShow({ duration: 60, title: "Wrapped Show" });
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            await insertUserSeason(userId, showId, 1, { addedAt: "2025-05-01" });

            const result = await service.getWrapped(userId, "2025");

            expect(result.year).toBe(2025);
            expect(result.topShow.label).toBe("Wrapped Show");
        });

        it("rejects an invalid year", async () => {
            const userId = await insertUser();

            await expect(service.getWrapped(userId, "1999")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("getLeaderboard", () => {
        it("ranks the user and their friends by this month's watch time", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });
            const friendId = await insertUser({ episodeTrackingEnabled: false });
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow({ duration: 120 });
            await insertSeason(showId, 1);
            await insertUserShow(friendId, showId);
            await insertUserSeason(friendId, showId, 1);

            const result = await service.getLeaderboard(userId);

            expect(result.map((r) => r.id)).toEqual([friendId, userId]);
            expect(result.find((r) => r.id === userId).isMe).toBe(true);
        });
    });
});
