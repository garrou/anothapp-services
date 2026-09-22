import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import SeasonService from "../../../services/seasonService.js";
import { resetDb } from "../resetDb.js";
import {
    insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode,
} from "../fixtures.js";

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

        it("rejects declining an already-declined invite instead of leaving it untouched (idempotent, not a re-stamp)", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);
            await service.respondToWatchedWith(friendId, userSeasonId, false);

            await expect(service.respondToWatchedWith(friendId, userSeasonId, false)).rejects.toMatchObject({ status: 409 });
        });

        it("rejects re-declining (leaving again) an already-revoked relation, instead of downgrading it to declined", async () => {
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

            await expect(service.respondToWatchedWith(friendId, userSeasonId, false)).rejects.toMatchObject({ status: 409 });

            // the historical "watched together" credit must survive - not silently flipped to declined
            const link = await db.query(`SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, friendId]);
            expect(link.rows[0]["status_id"]).toBe("revoked");
        });

        it("rejects re-accepting a stale declined or revoked invite - only a fresh invite from the owner can bring it back to pending", async () => {
            for (const leaveFirst of [false, true]) {
                const userId = await insertUser();
                const friendId = await insertUser();
                await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
                const showId = await insertShow();
                await insertSeason(showId, 1);
                await insertUserShow(userId, showId);
                const userSeasonId = await insertUserSeason(userId, showId, 1);
                await service.updateWatchedWith(userId, userSeasonId, [friendId]);

                if (leaveFirst) {
                    await service.respondToWatchedWith(friendId, userSeasonId, true);
                }
                await service.respondToWatchedWith(friendId, userSeasonId, false);

                await expect(service.respondToWatchedWith(friendId, userSeasonId, true)).rejects.toMatchObject({ status: 409 });
                const relation = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1`, [userSeasonId]);
                expect(relation.rowCount).toBe(0);
            }
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
            const relation = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1 AND friend_users_season_id = $2`, [userSeasonId, friendSeason.rows[0].id]);
            expect(relation.rowCount).toBe(1);
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
            const relations = await db.query(`
                SELECT friend_season.user_id AS friend_user_id
                FROM watch_together wt
                JOIN users_seasons friend_season ON friend_season.id = wt.friend_users_season_id
                WHERE wt.users_season_id = $1
            `, [userSeasonId]);
            expect(relations.rows.map((r) => r["friend_user_id"]).sort()).toEqual([friendA, friendB].sort());
        });

        it("when a second friend joins an existing group, the group-wide merge also reaches the first friend, not just the owner", async () => {
            const userId = await insertUser();
            const friendA = await insertUser();
            const friendB = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendA]);
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendB]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episode1 = await insertEpisode(showId, 1, {number: 1, date: "2020-01-01"});
            const episode2 = await insertEpisode(showId, 1, {number: 2});
            await service.updateWatchedWith(userId, userSeasonId, [friendA, friendB]);
            await service.respondToWatchedWith(friendA, userSeasonId, true);
            const friendASeason = await db.query(`SELECT id FROM users_seasons WHERE user_id = $1 AND show_id = $2`, [friendA, showId]);
            // friendA watches E1 live, after joining - the ongoing mirror already covers this
            await service.addEpisodeViewing(friendA, friendASeason.rows[0].id, episode1);
            // friendB already watched E2 on their own, before joining
            await insertUserShow(friendB, showId);
            const friendBExistingSeasonId = await insertUserSeason(friendB, showId, 1);
            await insertUserEpisode(friendB, friendBExistingSeasonId, episode2);

            await service.respondToWatchedWith(friendB, userSeasonId, true);

            const ownerEpisodes = await db.query(`SELECT episode_id FROM users_episodes WHERE users_seasons_id = $1`, [userSeasonId]);
            const friendAEpisodes = await db.query(`SELECT episode_id FROM users_episodes WHERE users_seasons_id = $1`, [friendASeason.rows[0].id]);
            const friendBEpisodes = await db.query(`SELECT episode_id FROM users_episodes WHERE users_seasons_id = $1`, [friendBExistingSeasonId]);
            expect(ownerEpisodes.rows.map((r) => r["episode_id"]).sort()).toEqual([episode1, episode2].sort());
            // Before the group-wide fix, only the owner (root) received friendB's episode2 - friendA,
            // an existing member of the group, never did.
            expect(friendAEpisodes.rows.map((r) => r["episode_id"]).sort()).toEqual([episode1, episode2].sort());
            expect(friendBEpisodes.rows.map((r) => r["episode_id"]).sort()).toEqual([episode1, episode2].sort());
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

        it("backfills the owner's already-watched episodes into the friend's newly linked viewing, preserving the original watched_at and platform_id", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await insertUserEpisode(userId, userSeasonId, episodeId, {watchedAt: "2024-01-15T20:00:00.000Z", platformId: 3});
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            await service.respondToWatchedWith(friendId, userSeasonId, true);

            const friendSeason = await db.query(`SELECT id FROM users_seasons WHERE user_id = $1 AND show_id = $2 AND number = 1`, [friendId, showId]);
            const friendViewing = await db.query(`SELECT episode_id, watched_at, platform_id FROM users_episodes WHERE users_seasons_id = $1 AND episode_id = $2`, [friendSeason.rows[0].id, episodeId]);
            expect(friendViewing.rowCount).toBe(1);
            expect(friendViewing.rows[0]).toMatchObject({
                episode_id: episodeId,
                watched_at: new Date("2024-01-15T20:00:00.000Z"),
                platform_id: 3,
            });
        });

        it("merges overlapping watched episodes from both sides without creating duplicates", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const episode1 = await insertEpisode(showId, 1, {number: 1});
            const episode2 = await insertEpisode(showId, 1, {number: 2});
            const episode3 = await insertEpisode(showId, 1, {number: 3});
            // owner watched E1, E2 - friend already watched E2, E3 on their own, before accepting
            await insertUserEpisode(userId, userSeasonId, episode1);
            await insertUserEpisode(userId, userSeasonId, episode2);
            await insertUserShow(friendId, showId);
            const friendExistingSeasonId = await insertUserSeason(friendId, showId, 1);
            await insertUserEpisode(friendId, friendExistingSeasonId, episode2);
            await insertUserEpisode(friendId, friendExistingSeasonId, episode3);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            await service.respondToWatchedWith(friendId, userSeasonId, true);

            const ownerEpisodes = await db.query(`SELECT episode_id FROM users_episodes WHERE users_seasons_id = $1`, [userSeasonId]);
            const friendEpisodes = await db.query(`SELECT episode_id FROM users_episodes WHERE users_seasons_id = $1`, [friendExistingSeasonId]);
            expect(ownerEpisodes.rows.map((r) => r["episode_id"]).sort()).toEqual([episode1, episode2, episode3].sort());
            expect(friendEpisodes.rows.map((r) => r["episode_id"]).sort()).toEqual([episode1, episode2, episode3].sort());
            // E2 was already watched by both sides before accepting - the merge must not have duplicated it
            const e2Count = await db.query(`SELECT COUNT(*) FROM users_episodes WHERE episode_id = $1`, [episode2]);
            expect(parseInt(e2Count.rows[0].count)).toBe(2);
        });

        it("also backfills the friend's own already-watched episodes into the owner's viewing", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendExistingSeasonId = await insertUserSeason(friendId, showId, 1);
            const episodeId = await insertEpisode(showId, 1);
            await insertUserEpisode(friendId, friendExistingSeasonId, episodeId);
            await service.updateWatchedWith(userId, userSeasonId, [friendId]);

            await service.respondToWatchedWith(friendId, userSeasonId, true);

            const ownerViewing = await db.query(`SELECT * FROM users_episodes WHERE users_seasons_id = $1 AND episode_id = $2`, [userSeasonId, episodeId]);
            expect(ownerViewing.rowCount).toBe(1);
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
            const relation = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1`, [userSeasonId]);
            expect(relation.rowCount).toBe(0);
        });

        it("rejects with a 400 for a missing or unknown status", async () => {
            const userId = await insertUser();

            await expect(service.getWatchedWith(userId, undefined)).rejects.toMatchObject({ status: 400 });
            await expect(service.getWatchedWith(userId, "unknown")).rejects.toMatchObject({ status: 400 });
        });
    });
});
