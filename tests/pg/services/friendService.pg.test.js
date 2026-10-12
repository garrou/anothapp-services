import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import FriendService from "../../../services/friendService.js";
import SeasonService from "../../../services/seasonService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertPlaylist, insertShow, insertUserShow, insertSeason, insertUserSeason } from "../fixtures.js";

describe("FriendService (real Postgres)", () => {
    /** @type {FriendService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new FriendService();
    });

    describe("sendFriendRequest", () => {
        it("creates a pending request", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();

            await service.sendFriendRequest(userId, otherId);

            const res = await db.query(`SELECT accepted FROM friends WHERE fst_user_id = $1 AND sec_user_id = $2`, [userId, otherId]);
            expect(res.rows[0].accepted).toBe(false);
        });

        it("rejects a duplicate request", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);

            await expect(service.sendFriendRequest(userId, otherId)).rejects.toMatchObject({ status: 409 });
        });

        it("rejects without a target user id", async () => {
            const userId = await insertUser();

            await expect(service.sendFriendRequest(userId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("acceptFriend", () => {
        it("accepts the request", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);

            await service.acceptFriend(otherId, userId, userId);

            const result = await service.getFriends(userId, "friends");
            expect(result.map((f) => f.id)).toEqual([otherId]);
        });

        it("rejects a mismatched body/param user id", async () => {
            const userId = await insertUser();

            await expect(service.acceptFriend(userId, "a", "b")).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("deleteFriend", () => {
        it("deletes the friendship and revokes any playlist collaboration granted through it", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);
            await service.acceptFriend(otherId, userId, userId);
            const playlistId = await insertPlaylist(userId);
            await db.query(`INSERT INTO playlists_collaborators (playlist_id, user_id, accepted) VALUES ($1, $2, TRUE)`, [playlistId, otherId]);

            await service.deleteFriend(userId, otherId);

            const friends = await db.query(`SELECT * FROM friends WHERE fst_user_id = $1 OR sec_user_id = $1`, [userId]);
            expect(friends.rowCount).toBe(0);
            const collaborators = await db.query(`SELECT * FROM playlists_collaborators WHERE playlist_id = $1`, [playlistId]);
            expect(collaborators.rowCount).toBe(0);
        });

        it("throws when there is nothing to delete", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();

            await expect(service.deleteFriend(userId, otherId)).rejects.toMatchObject({ status: 500 });
        });

        it("declines any active watch-together link between the two users, without deleting synced episodes", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);
            await service.acceptFriend(otherId, userId, userId);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const seasonService = new SeasonService();
            await seasonService.updateWatchedWith(userId, userSeasonId, [otherId]);

            await service.deleteFriend(userId, otherId);

            const link = await db.query(`SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, otherId]);
            expect(link.rows[0]["status_id"]).toBe("declined");
        });

        it("ends an accepted watch-together relation and keeps its historical tag as revoked", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);
            await service.acceptFriend(otherId, userId, userId);
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            const seasonService = new SeasonService();
            seasonService._showService._searchService.getByShowId = async () => { throw new Error("should not be called"); };
            seasonService._showService._searchService.getSeasonByShowIdByNumber = async () => { throw new Error("should not be called"); };
            await seasonService.updateWatchedWith(userId, userSeasonId, [otherId]);
            await seasonService.respondToWatchedWith(otherId, userSeasonId, true);

            await service.deleteFriend(userId, otherId);

            const tag = await db.query(`SELECT status_id FROM users_seasons_friends WHERE users_season_id = $1 AND friend_user_id = $2`, [userSeasonId, otherId]);
            expect(tag.rows[0]["status_id"]).toBe("revoked");
            const relation = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1`, [userSeasonId]);
            expect(relation.rowCount).toBe(0);
        });

        it("rolls back the friendship deletion itself when a later step in the same transaction fails", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);
            await service.acceptFriend(otherId, userId, userId);
            service._watchTogetherRepository.removeAllBetweenUsers = async () => { throw new Error("boom"); };

            await expect(service.deleteFriend(userId, otherId)).rejects.toThrow("boom");

            const friends = await db.query(`SELECT * FROM friends WHERE fst_user_id = $1 OR sec_user_id = $1`, [userId]);
            expect(friends.rowCount).toBe(1);
        });

        it("clears the auto-accept preference in both directions, so a later re-friend starts clean", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);
            await service.acceptFriend(otherId, userId, userId);
            await db.query(`INSERT INTO users_auto_accept_watch_together (user_id, friend_user_id) VALUES ($1, $2)`, [userId, otherId]);
            await db.query(`INSERT INTO users_auto_accept_watch_together (user_id, friend_user_id) VALUES ($1, $2)`, [otherId, userId]);

            await service.deleteFriend(userId, otherId);

            const rows = await db.query(`SELECT * FROM users_auto_accept_watch_together WHERE user_id IN ($1, $2)`, [userId, otherId]);
            expect(rows.rowCount).toBe(0);
        });
    });

    describe("getAutoAcceptWatchTogether / setAutoAcceptWatchTogether", () => {
        it("defaults to disabled and can be turned on and off", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);
            await service.acceptFriend(otherId, userId, userId);

            expect(await service.getAutoAcceptWatchTogether(userId, otherId)).toBe(false);

            await service.setAutoAcceptWatchTogether(userId, otherId, true);
            expect(await service.getAutoAcceptWatchTogether(userId, otherId)).toBe(true);

            await service.setAutoAcceptWatchTogether(userId, otherId, false);
            expect(await service.getAutoAcceptWatchTogether(userId, otherId)).toBe(false);
        });

        it("is one-sided - enabling it for a friend does not enable it in the other direction", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await service.sendFriendRequest(userId, otherId);
            await service.acceptFriend(otherId, userId, userId);

            await service.setAutoAcceptWatchTogether(userId, otherId, true);

            expect(await service.getAutoAcceptWatchTogether(otherId, userId)).toBe(false);
        });

        it("rejects when the two users aren't friends", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();

            await expect(service.getAutoAcceptWatchTogether(userId, strangerId)).rejects.toMatchObject({ status: 400 });
            await expect(service.setAutoAcceptWatchTogether(userId, strangerId, true)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("getFriends", () => {
        it("returns sent/received/friends buckets when no status is given", async () => {
            const userId = await insertUser();
            const sentTo = await insertUser();
            await service.sendFriendRequest(userId, sentTo);

            const result = await service.getFriends(userId);

            expect(result.sent.map((u) => u.id)).toEqual([sentTo]);
            expect(result.received).toEqual([]);
            expect(result.friends).toEqual([]);
        });

        it("returns friends who watch a given show for status=viewed", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await service.sendFriendRequest(userId, friendId);
            await service.acceptFriend(friendId, userId, userId);
            const showId = await insertShow();
            await insertUserShow(friendId, showId);

            const result = await service.getFriends(userId, "viewed", showId);

            expect(result.map((u) => u.id)).toEqual([friendId]);
        });
    });
});
