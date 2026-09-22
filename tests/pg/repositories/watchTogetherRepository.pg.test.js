import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import WatchTogetherRepository from "../../../repositories/watchTogetherRepository.js";
import UserSeasonFriendRepository from "../../../repositories/userSeasonFriendRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

describe("WatchTogetherRepository (real Postgres)", () => {
    /** @type {WatchTogetherRepository} */
    let repo;
    /** @type {UserSeasonFriendRepository} */
    let friendRepo;

    beforeEach(async () => {
        await resetDb();
        repo = new WatchTogetherRepository();
        friendRepo = new UserSeasonFriendRepository();
    });

    describe("lockSeasons", () => {
        it("locks both seasons within a transaction without erroring, regardless of the order given", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const seasonA = await insertUserSeason(userId, showId, 1);
            const seasonB = await insertUserSeason(userId, showId, 1);

            await db.transaction(async (client) => {
                await repo.lockSeasons(client, seasonA, seasonB);
                await repo.lockSeasons(client, seasonB, seasonA);
            });
        });
    });

    describe("create / remove", () => {
        it("creates a relation between two viewings", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);

            const created = await repo.create(userSeasonId, friendSeasonId);

            expect(created).toBe(true);
            const res = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1`, [userSeasonId]);
            expect(res.rowCount).toBe(1);
        });

        it("removing a relation never touches the historical tag in users_seasons_friends", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await friendRepo.setForUserSeasonId(userSeasonId, [friendId]);
            await friendRepo.accept(userSeasonId, friendId);
            await repo.create(userSeasonId, friendSeasonId);

            await repo.remove(userSeasonId, friendId);

            const res = await db.query(`SELECT * FROM watch_together WHERE users_season_id = $1`, [userSeasonId]);
            expect(res.rowCount).toBe(0);
            expect(await friendRepo.getStatus(userSeasonId, friendId)).toBe("accepted");
        });

        it("removing when no relation exists is a no-op", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await expect(repo.remove(userSeasonId, friendId)).resolves.toBeUndefined();
        });
    });

    describe("removeAllBetweenUsers", () => {
        it("removes relations between the two users in either direction, leaving others untouched", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const otherFriendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await insertUserShow(otherFriendId, showId);
            const otherFriendSeasonId = await insertUserSeason(otherFriendId, showId, 1);
            await repo.create(userSeasonId, friendSeasonId);
            await repo.create(userSeasonId, otherFriendSeasonId);

            await repo.removeAllBetweenUsers(userId, friendId);

            const remaining = await db.query(`
                SELECT friend_season.user_id AS friend_user_id
                FROM watch_together wt
                JOIN users_seasons friend_season ON friend_season.id = wt.friend_users_season_id
                WHERE wt.users_season_id = $1
            `, [userSeasonId]);
            expect(remaining.rows.map((r) => r["friend_user_id"])).toEqual([otherFriendId]);
        });
    });

    describe("hasConflictingLink", () => {
        it("is false for two free viewings", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            expect(await repo.hasConflictingLink(userSeasonId, 999999)).toBe(false);
        });

        it("is true once the friend's viewing is already someone's accepted friend-slot", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(ownerId, showId);
            const ownerSeasonId = await insertUserSeason(ownerId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await repo.create(ownerSeasonId, friendSeasonId);

            const newOwnerId = await insertUser();
            await insertUserShow(newOwnerId, showId);
            const newOwnerSeasonId = await insertUserSeason(newOwnerId, showId, 1);

            expect(await repo.hasConflictingLink(newOwnerSeasonId, friendSeasonId)).toBe(true);
        });

        it("is true once the friend's viewing is itself a root with its own accepted friends", async () => {
            const ownerId = await insertUser();
            const friendId = await insertUser();
            const subFriendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await insertUserShow(subFriendId, showId);
            const subFriendSeasonId = await insertUserSeason(subFriendId, showId, 1);
            await repo.create(friendSeasonId, subFriendSeasonId);

            await insertUserShow(ownerId, showId);
            const ownerSeasonId = await insertUserSeason(ownerId, showId, 1);

            expect(await repo.hasConflictingLink(ownerSeasonId, friendSeasonId)).toBe(true);
        });

        it("is true once the invite's own viewing is already someone else's accepted friend-slot", async () => {
            const rootOwnerId = await insertUser();
            const middleUserId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(rootOwnerId, showId);
            const rootSeasonId = await insertUserSeason(rootOwnerId, showId, 1);
            await insertUserShow(middleUserId, showId);
            const middleSeasonId = await insertUserSeason(middleUserId, showId, 1);
            await repo.create(rootSeasonId, middleSeasonId);

            const newFriendId = await insertUser();
            await insertUserShow(newFriendId, showId);
            const newFriendSeasonId = await insertUserSeason(newFriendId, showId, 1);

            expect(await repo.hasConflictingLink(middleSeasonId, newFriendSeasonId)).toBe(true);
        });

        it("is false for a root with other accepted friends - a season can share with several friends at once", async () => {
            const ownerId = await insertUser();
            const friendA = await insertUser();
            const friendB = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(ownerId, showId);
            const ownerSeasonId = await insertUserSeason(ownerId, showId, 1);
            await insertUserShow(friendA, showId);
            const friendASeasonId = await insertUserSeason(friendA, showId, 1);
            await repo.create(ownerSeasonId, friendASeasonId);

            await insertUserShow(friendB, showId);
            const friendBSeasonId = await insertUserSeason(friendB, showId, 1);

            expect(await repo.hasConflictingLink(ownerSeasonId, friendBSeasonId)).toBe(false);
        });
    });

    describe("getActiveForUser", () => {
        it("lists active watch-together relations for a friend, with the owner as actor", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow({ title: "Dexter" });
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 2);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 2);
            await repo.create(userSeasonId, friendSeasonId);

            const active = await repo.getActiveForUser(friendId);

            expect(active).toEqual([{
                userSeasonId, showId, showTitle: "Dexter", showPoster: null, seasonNumber: 2,
                actor: { id: userId, username: expect.any(String), picture: null }, isOwner: false,
            }]);
        });

        it("also lists it for the owner, with the friend as actor", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow({ title: "Dexter" });
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 2);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 2);
            await repo.create(userSeasonId, friendSeasonId);

            const active = await repo.getActiveForUser(userId);

            expect(active).toEqual([{
                userSeasonId, showId, showTitle: "Dexter", showPoster: null, seasonNumber: 2,
                actor: { id: friendId, username: expect.any(String), picture: null }, isOwner: true,
            }]);
        });

        it("returns nothing once the relation has been removed", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await repo.create(userSeasonId, friendSeasonId);
            await repo.remove(userSeasonId, friendId);

            expect(await repo.getActiveForUser(friendId)).toEqual([]);
            expect(await repo.getActiveForUser(userId)).toEqual([]);
        });
    });

    describe("getOwnersByFriendSeasonIds", () => {
        it("returns an empty map without querying when there are no season ids", async () => {
            expect((await repo.getOwnersByFriendSeasonIds([])).size).toBe(0);
        });

        it("maps the sharing owner by friend season id, only for active relations", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await repo.create(userSeasonId, friendSeasonId);

            const owners = await repo.getOwnersByFriendSeasonIds([friendSeasonId, userSeasonId]);

            expect(owners.get(friendSeasonId)).toEqual({ id: userId, username: expect.any(String), picture: null });
            expect(owners.has(userSeasonId)).toBe(false);
        });
    });

    describe("getLinkedViewings", () => {
        it("returns the other members of the group when queried from the root viewing", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await repo.create(userSeasonId, friendSeasonId);

            const linked = await repo.getLinkedViewings(userSeasonId);

            expect(linked).toEqual([{ id: friendSeasonId, userId: friendId }]);
        });

        it("returns the root when queried from a friend's own viewing", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await insertUserShow(friendId, showId);
            const friendSeasonId = await insertUserSeason(friendId, showId, 1);
            await repo.create(userSeasonId, friendSeasonId);

            const linked = await repo.getLinkedViewings(friendSeasonId);

            expect(linked).toEqual([{ id: userSeasonId, userId }]);
        });

        it("returns every other friend when a root shares with several friends at once", async () => {
            const ownerId = await insertUser();
            const friendA = await insertUser();
            const friendB = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(ownerId, showId);
            const ownerSeasonId = await insertUserSeason(ownerId, showId, 1);
            await insertUserShow(friendA, showId);
            const friendASeasonId = await insertUserSeason(friendA, showId, 1);
            await insertUserShow(friendB, showId);
            const friendBSeasonId = await insertUserSeason(friendB, showId, 1);
            await repo.create(ownerSeasonId, friendASeasonId);
            await repo.create(ownerSeasonId, friendBSeasonId);

            const linked = await repo.getLinkedViewings(ownerSeasonId);

            expect(linked.sort((a, b) => a.id - b.id)).toEqual(
                [{ id: friendASeasonId, userId: friendA }, { id: friendBSeasonId, userId: friendB }].sort((a, b) => a.id - b.id)
            );
        });

        it("returns nothing for a viewing with no watch-together relation", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            expect(await repo.getLinkedViewings(userSeasonId)).toEqual([]);
        });
    });
});
