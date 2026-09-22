import { describe, it, expect, beforeEach } from "vitest";
import UserSeasonFriendRepository from "../../../repositories/userSeasonFriendRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

describe("UserSeasonFriendRepository (real Postgres)", () => {
    /** @type {UserSeasonFriendRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserSeasonFriendRepository();
    });

    describe("setForUserSeasonId / getByUserSeasonIds", () => {
        it("links friends to a watched season", async () => {
            const userId = await insertUser();
            const friendA = await insertUser({ username: "FriendA" });
            const friendB = await insertUser({ username: "FriendB" });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            await repo.setForUserSeasonId(userSeasonId, [friendA, friendB]);

            const result = await repo.getByUserSeasonIds([userSeasonId]);
            expect(result.get(userSeasonId).map((f) => f.username).sort()).toEqual(["FriendA", "FriendB"]);
        });

        it("keeps a pending friend dropped from the list, marked declined, instead of removing them", async () => {
            const userId = await insertUser();
            const friendA = await insertUser({ username: "FriendA" });
            const friendB = await insertUser({ username: "FriendB" });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);

            await repo.setForUserSeasonId(userSeasonId, [friendB]);

            const result = await repo.getByUserSeasonIds([userSeasonId]).then((m) => m.get(userSeasonId));
            expect(result.map((f) => f.username).sort()).toEqual(["FriendA", "FriendB"]);
            expect(result.find((f) => f.username === "FriendA").status).toBe("declined");
            expect(result.find((f) => f.username === "FriendB").status).toBe("pending");
        });

        it("keeps an accepted friend dropped from the list marked revoked, and reports them for the caller to end their live relation", async () => {
            const userId = await insertUser();
            const friendA = await insertUser({ username: "FriendA" });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);
            await repo.accept(userSeasonId, friendA);

            const { revoked } = await repo.setForUserSeasonId(userSeasonId, []);

            expect(revoked).toEqual([friendA]);
            const result = await repo.getByUserSeasonIds([userSeasonId]).then((m) => m.get(userSeasonId));
            expect(result[0].status).toBe("revoked");
        });

        it("keeps a revoked friend untouched (not re-declined) on a later save where they're still absent", async () => {
            const userId = await insertUser();
            const friendA = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);
            await repo.accept(userSeasonId, friendA);
            await repo.setForUserSeasonId(userSeasonId, []);

            const { invited, revoked } = await repo.setForUserSeasonId(userSeasonId, []);

            expect(invited).toEqual([]);
            expect(revoked).toEqual([]);
            const result = await repo.getByUserSeasonIds([userSeasonId]).then((m) => m.get(userSeasonId));
            expect(result[0].status).toBe("revoked");
        });

        it("re-adding a revoked friend resets them to pending", async () => {
            const userId = await insertUser();
            const friendA = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);
            await repo.accept(userSeasonId, friendA);
            await repo.setForUserSeasonId(userSeasonId, []);

            const { invited } = await repo.setForUserSeasonId(userSeasonId, [friendA]);

            expect(invited).toEqual([friendA]);
            const result = await repo.getByUserSeasonIds([userSeasonId]).then((m) => m.get(userSeasonId));
            expect(result[0].status).toBe("pending");
        });

        it("declines rather than deletes when given an empty list", async () => {
            const userId = await insertUser();
            const friendA = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);

            const { invited } = await repo.setForUserSeasonId(userSeasonId, []);

            expect(invited).toEqual([]);
            const result = await repo.getByUserSeasonIds([userSeasonId]).then((m) => m.get(userSeasonId));
            expect(result[0].status).toBe("declined");
        });

        it("re-adding a declined friend resets them to pending", async () => {
            const userId = await insertUser();
            const friendA = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);
            await repo.setForUserSeasonId(userSeasonId, []);

            const { invited } = await repo.setForUserSeasonId(userSeasonId, [friendA]);

            expect(invited).toEqual([friendA]);
            const result = await repo.getByUserSeasonIds([userSeasonId]).then((m) => m.get(userSeasonId));
            expect(result[0].status).toBe("pending");
        });

        it("getByUserSeasonIds returns an empty map for an empty list", async () => {
            const result = await repo.getByUserSeasonIds([]);

            expect(result.size).toBe(0);
        });
    });

    describe("accept / decline / getStatus", () => {
        it("accept sets the status to accepted", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendId]);

            const linked = await repo.accept(userSeasonId, friendId);

            expect(linked).toBe(true);
            expect(await repo.getStatus(userSeasonId, friendId)).toBe("accepted");
        });

        it("decline marks a never-accepted invite declined", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendId]);

            const declined = await repo.decline(userSeasonId, friendId);

            expect(declined).toBe(true);
            expect(await repo.getStatus(userSeasonId, friendId)).toBe("declined");
        });

        it("decline marks a previously accepted invite revoked instead of declined", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendId]);
            await repo.accept(userSeasonId, friendId);

            await repo.decline(userSeasonId, friendId);

            expect(await repo.getStatus(userSeasonId, friendId)).toBe("revoked");
        });

        it("getStatus returns undefined when there is no link at all", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);

            expect(await repo.getStatus(userSeasonId, friendId)).toBeUndefined();
        });
    });

    describe("declineAllBetweenUsers", () => {
        it("declines a pending link and revokes an accepted one, between the two users in either direction, leaving others untouched", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const otherFriendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendId, otherFriendId]);
            await repo.accept(userSeasonId, friendId);

            await repo.declineAllBetweenUsers(userId, friendId);

            const result = await repo.getByUserSeasonIds([userSeasonId]).then((m) => m.get(userSeasonId));
            expect(result.find((f) => f.id === friendId).status).toBe("revoked");
            expect(result.find((f) => f.id === otherFriendId).status).toBe("pending");
        });
    });

    describe("getPendingForUser", () => {
        it("lists pending invitations for a user, not the ones they sent or already answered", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow({ title: "Dexter" });
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 2);
            await repo.setForUserSeasonId(userSeasonId, [friendId]);

            const pending = await repo.getPendingForUser(friendId);

            expect(pending).toEqual([{
                userSeasonId, showId, showTitle: "Dexter", showPoster: null, seasonNumber: 2,
                actor: { id: userId, username: expect.any(String), picture: null },
            }]);
            expect(await repo.getPendingForUser(userId)).toEqual([]);
        });

        it("excludes an invitation once it has been accepted or declined", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendId]);
            await repo.decline(userSeasonId, friendId);

            expect(await repo.getPendingForUser(friendId)).toEqual([]);
        });
    });

    describe("getTopFriendsByUserId / getDistinctFriendsCountByUserId", () => {
        it("counts watches with a friend from both directions (as watcher and as tagged friend)", async () => {
            const userId = await insertUser();
            const friendA = await insertUser({ username: "FriendA" });
            const friendB = await insertUser({ username: "FriendB" });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId);
            const season1 = await insertUserSeason(userId, showId, 1);
            const season2 = await insertUserSeason(userId, showId, 2);
            await repo.setForUserSeasonId(season1, [friendA]);
            await repo.setForUserSeasonId(season2, [friendA, friendB]);

            await insertUserShow(friendA, showId);
            const friendASeason = await insertUserSeason(friendA, showId, 1);
            await repo.setForUserSeasonId(friendASeason, [userId]);

            const result = await repo.getTopFriendsByUserId(userId);

            expect(result[0]).toMatchObject({ id: friendA, label: "FriendA", value: 3 });
            expect(result[1]).toMatchObject({ id: friendB, label: "FriendB", value: 1 });
            expect(await repo.getDistinctFriendsCountByUserId(userId)).toBe(2);
        });

        it("still counts a revoked (previously accepted) watch, but not a declined one", async () => {
            const userId = await insertUser();
            const friendA = await insertUser({ username: "FriendA" });
            const friendB = await insertUser({ username: "FriendB" });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId);
            const season1 = await insertUserSeason(userId, showId, 1);
            const season2 = await insertUserSeason(userId, showId, 2);
            await repo.setForUserSeasonId(season1, [friendA]);
            await repo.accept(season1, friendA);
            await repo.decline(season1, friendA);
            await repo.setForUserSeasonId(season2, [friendB]);
            await repo.decline(season2, friendB);

            const result = await repo.getTopFriendsByUserId(userId);

            expect(result).toEqual([{ id: friendA, label: "FriendA", value: 1 }]);
            expect(await repo.getDistinctFriendsCountByUserId(userId)).toBe(1);
        });

        it("returns an empty array/0 for a user who never watched with friends", async () => {
            const userId = await insertUser();

            expect(await repo.getTopFriendsByUserId(userId)).toEqual([]);
            expect(await repo.getDistinctFriendsCountByUserId(userId)).toBe(0);
        });
    });

    describe("getTopFriendByUserIdByYear", () => {
        it("only counts watches added during the given year", async () => {
            const userId = await insertUser();
            const friendId = await insertUser({ username: "FriendA" });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertSeason(showId, 2);
            await insertUserShow(userId, showId);
            const season2025 = await insertUserSeason(userId, showId, 1, { addedAt: "2025-06-01" });
            const season2026 = await insertUserSeason(userId, showId, 2, { addedAt: "2026-01-01" });
            await repo.setForUserSeasonId(season2025, [friendId]);
            await repo.setForUserSeasonId(season2026, [friendId]);

            const result = await repo.getTopFriendByUserIdByYear(userId, 2025);

            expect(result).toMatchObject({ id: friendId, label: "FriendA", value: 1 });
        });

        it("returns null when there is no watch-with-friend in that year", async () => {
            const userId = await insertUser();

            const result = await repo.getTopFriendByUserIdByYear(userId, 2025);

            expect(result).toBeNull();
        });
    });
});
