import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import SeasonService from "../../../services/seasonService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

describe("SeasonService (real Postgres)", () => {
    /** @type {SeasonService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new SeasonService();
        // The auto-add-on-accept path can fall back to the real Betaseries API when a show/season
        // isn't known locally yet - tests pre-seed what they need and stub these to guard against
        // an accidental real network call, following the same pattern as showService.pg.test.js.
        service._showService._searchService.getByShowId = async () => { throw new Error("should not be called"); };
        service._showService._searchService.getSeasonByShowIdByNumber = async () => { throw new Error("should not be called"); };
    });

    describe("deleteBySeasonId", () => {
        it("deletes the user's watched season", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await service.deleteBySeasonId(userId, userSeasonId);

            const res = await db.query(`SELECT * FROM users_seasons WHERE id = $1`, [userSeasonId]);
            expect(res.rowCount).toBe(0);
        });

        it("rejects without a season id", async () => {
            const userId = await insertUser();

            await expect(service.deleteBySeasonId(userId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateBySeasonId", () => {
        it("updates the platform and viewing date, and syncs episode platforms", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await service.updateBySeasonId(userId, userSeasonId, 1, "2025-01-01");

            const res = await db.query(`SELECT platform_id FROM users_seasons WHERE id = $1`, [userSeasonId]);
            expect(res.rows[0]["platform_id"]).toBe(1);
        });

        it("rejects missing fields", async () => {
            const userId = await insertUser();

            await expect(service.updateBySeasonId(userId, 1, undefined, "2025-01-01")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateWatchedWith", () => {
        it("tags friends who watched the season together", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            const res = await db.query(`SELECT friend_user_id FROM users_seasons_friends WHERE users_season_id = $1`, [userSeasonId]);
            expect(res.rows.map((r) => r["friend_user_id"])).toEqual([friendId]);
        });

        it("rejects tagging someone who isn't a friend", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await expect(service.updateWatchedWith(userId, userSeasonId, [strangerId])).rejects.toMatchObject({ status: 400 });
        });

        it("rejects tagging more than the max allowed friends", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const tooMany = Array.from({ length: 11 }, (_, i) => `friend-${i}`);

            await expect(service.updateWatchedWith(userId, userSeasonId, tooMany)).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a season the user doesn't own", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(otherUserId, showId);
            const userSeasonId = await insertUserSeason(otherUserId, showId, 1);

            await expect(service.updateWatchedWith(userId, userSeasonId, [])).rejects.toMatchObject({ status: 404 });
        });
    });

    describe("respondToWatchedWith", () => {
        it("rejects when there is no invitation for this user", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await expect(service.respondToWatchedWith(friendId, userSeasonId, true)).rejects.toMatchObject({ status: 404 });
        });

        it("declining marks the link declined without creating anything for the friend", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            await service.respondToWatchedWith(friendId, userSeasonId, false);

            const link = await db.query(`SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, friendId]);
            expect(link.rows[0]["status_id"]).toBe("declined");
            const friendShow = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [friendId, showId]);
            expect(friendShow.rowCount).toBe(0);
        });

        it("accepting auto-adds the show and season for the friend, copying the owner's platform", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1, { platformId: 1 });
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            await service.respondToWatchedWith(friendId, userSeasonId, true);

            const friendShow = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [friendId, showId]);
            expect(friendShow.rowCount).toBe(1);
            const friendSeason = await db.query(`SELECT id, platform_id FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [friendId, showId]);
            expect(friendSeason.rows[0]["platform_id"]).toBe(1);
            const tag = await db.query(`SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, friendId]);
            expect(tag.rows[0]["status_id"]).toBe("accepted");
            const relation = await db.query(`SELECT friend_users_season_id FROM watch_together WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, friendId]);
            expect(relation.rows[0]["friend_users_season_id"]).toBe(friendSeason.rows[0].id);
        });

        it("a single owner can share the same season with several friends at once", async () => {
            const userId = await insertUser();
            const friendA = await insertUser();
            const friendB = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendA]);
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendB]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendA, friendB]);

            await service.respondToWatchedWith(friendA, userSeasonId, true);
            await service.respondToWatchedWith(friendB, userSeasonId, true);

            expect(await service.getWatchedWith(friendA, "active")).toHaveLength(1);
            expect(await service.getWatchedWith(friendB, "active")).toHaveLength(1);
            const relations = await db.query(`SELECT friend_user_id FROM watch_together WHERE users_season_id = $1`, [userSeasonId]);
            expect(relations.rows.map((r) => r["friend_user_id"]).sort()).toEqual([friendA, friendB].sort());
        });

        it("accepting reuses the friend's existing viewing instead of creating a duplicate", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendExistingSeasonId = await insertUserSeason(friendId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            await service.respondToWatchedWith(friendId, userSeasonId, true);

            const friendSeasons = await db.query(`SELECT id FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [friendId, showId]);
            expect(friendSeasons.rowCount).toBe(1);
            expect(friendSeasons.rows[0].id).toBe(friendExistingSeasonId);
        });

        it("rejects when the friend's viewing is already part of another watch-together group", async () => {
            const userId = await insertUser();
            const otherOwnerId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [otherOwnerId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(otherOwnerId, showId);
            const otherOwnerSeasonId = await insertUserSeason(otherOwnerId, showId, 1);
            await service.updateWatchedWith(otherOwnerId, otherOwnerSeasonId, [friendId]);
            await service.respondToWatchedWith(friendId, otherOwnerSeasonId, true);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            await expect(service.respondToWatchedWith(friendId, userSeasonId, true)).rejects.toMatchObject({ status: 409 });
        });

        it("rejects accepting once the two users are no longer friends", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);
            await db.query(`DELETE FROM friends WHERE fst_user_id = $1 AND sec_user_id = $2`, [userId, friendId]);

            await expect(service.respondToWatchedWith(friendId, userSeasonId, true)).rejects.toMatchObject({ status: 400 });

            const friendShow = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [friendId, showId]);
            expect(friendShow.rowCount).toBe(0);
        });
    });

    describe("getWatchedWith", () => {
        it("status=pending lists the current user's pending invitations", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            const pending = await service.getWatchedWith(friendId, "pending");

            expect(pending).toHaveLength(1);
            expect(pending[0].userSeasonId).toBe(userSeasonId);
        });

        it("status=active lists the current user's active (accepted) watch-together links", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);
            await service.respondToWatchedWith(friendId, userSeasonId, true);

            const active = await service.getWatchedWith(friendId, "active");

            expect(active).toHaveLength(1);
            expect(active[0].userSeasonId).toBe(userSeasonId);
            expect(await service.getWatchedWith(friendId, "pending")).toEqual([]);
        });

        it("no longer lists a link as active once the friend leaves after accepting, but keeps the historical tag as revoked", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);
            await service.respondToWatchedWith(friendId, userSeasonId, true);

            await service.respondToWatchedWith(friendId, userSeasonId, false);

            expect(await service.getWatchedWith(friendId, "active")).toEqual([]);
            const tag = await db.query(`SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, friendId]);
            expect(tag.rows[0]["status_id"]).toBe("revoked");
            const relation = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, friendId]);
            expect(relation.rowCount).toBe(0);
        });

        it("rejects with a 400 for a missing or unknown status", async () => {
            const userId = await insertUser();

            await expect(service.getWatchedWith(userId, undefined)).rejects.toMatchObject({ status: 400 });
            await expect(service.getWatchedWith(userId, "unknown")).rejects.toMatchObject({ status: 400 });
        });
    });
});
