import { describe, it, expect, beforeEach } from "vitest";
import FriendRepository from "./friendRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import { insertUser, insertShow, insertUserShow } from "../tests/pg/fixtures.js";

describe("FriendRepository (real Postgres)", () => {
    /** @type {FriendRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new FriendRepository();
    });

    describe("sendFriendRequest / checkIfRelationExists / checkIfAlreadyFriend", () => {
        it("creates a pending relation", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();

            const result = await repo.sendFriendRequest(userId, otherId);

            expect(result).toBe(true);
            expect(await repo.checkIfRelationExists(userId, otherId)).toBe(true);
            expect(await repo.checkIfAlreadyFriend(userId, otherId)).toBe(false);
        });

        it("checkIfRelationExists is symmetric regardless of who sent the request", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await repo.sendFriendRequest(userId, otherId);

            expect(await repo.checkIfRelationExists(otherId, userId)).toBe(true);
        });
    });

    describe("acceptFriend", () => {
        it("accepts a pending request regardless of direction", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await repo.sendFriendRequest(userId, otherId);

            const result = await repo.acceptFriend(otherId, userId);

            expect(result).toBe(true);
            expect(await repo.checkIfAlreadyFriend(userId, otherId)).toBe(true);
        });

        it("returns false when there is no pending request", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();

            const result = await repo.acceptFriend(userId, otherId);

            expect(result).toBe(false);
        });
    });

    describe("getFriends", () => {
        it("returns accepted friends from both relation directions", async () => {
            const userId = await insertUser();
            const friendA = await insertUser({ username: "FriendA" });
            const friendB = await insertUser({ username: "FriendB" });
            await repo.sendFriendRequest(userId, friendA);
            await repo.acceptFriend(userId, friendA);
            await repo.sendFriendRequest(friendB, userId);
            await repo.acceptFriend(friendB, userId);

            const result = await repo.getFriends(userId);

            expect(result.map((f) => f.username).sort()).toEqual(["FriendA", "FriendB"]);
        });

        it("excludes pending (not yet accepted) requests", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await repo.sendFriendRequest(userId, otherId);

            const result = await repo.getFriends(userId);

            expect(result).toEqual([]);
        });
    });

    describe("getFriendsRequestsSend / getFriendsRequestsReceive", () => {
        it("lists sent and received pending requests separately", async () => {
            const userId = await insertUser();
            const sentTo = await insertUser({ username: "SentTo" });
            const receivedFrom = await insertUser({ username: "ReceivedFrom" });
            await repo.sendFriendRequest(userId, sentTo);
            await repo.sendFriendRequest(receivedFrom, userId);

            const sent = await repo.getFriendsRequestsSend(userId);
            const received = await repo.getFriendsRequestsReceive(userId);

            expect(sent.map((u) => u.username)).toEqual(["SentTo"]);
            expect(received.map((u) => u.username)).toEqual(["ReceivedFrom"]);
        });
    });

    describe("getFriendsWhoWatchSerie", () => {
        it("returns only accepted friends who watch the show", async () => {
            const userId = await insertUser();
            const friendId = await insertUser({ username: "WatchesToo" });
            const nonFriendId = await insertUser({ username: "NotAFriend" });
            await repo.sendFriendRequest(userId, friendId);
            await repo.acceptFriend(userId, friendId);
            await repo.sendFriendRequest(userId, nonFriendId);

            const showId = await insertShow();
            await insertUserShow(friendId, showId);
            await insertUserShow(nonFriendId, showId);

            const result = await repo.getFriendsWhoWatchSerie(userId, showId);

            expect(result.map((u) => u.username)).toEqual(["WatchesToo"]);
        });
    });

    describe("deleteFriend", () => {
        it("deletes an accepted friendship and reports it was accepted", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await repo.sendFriendRequest(userId, otherId);
            await repo.acceptFriend(userId, otherId);

            const result = await repo.deleteFriend(userId, otherId);

            expect(result).toEqual({ requesterId: userId, wasAccepted: true });
            expect(await repo.checkIfRelationExists(userId, otherId)).toBe(false);
        });

        it("deletes a pending request and reports it was not accepted", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();
            await repo.sendFriendRequest(userId, otherId);

            const result = await repo.deleteFriend(userId, otherId);

            expect(result).toEqual({ requesterId: userId, wasAccepted: false });
        });

        it("returns null when there is no relation to delete", async () => {
            const userId = await insertUser();
            const otherId = await insertUser();

            const result = await repo.deleteFriend(userId, otherId);

            expect(result).toBeNull();
        });
    });
});
