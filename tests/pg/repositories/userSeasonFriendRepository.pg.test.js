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

        it("replaces the previous set of friends", async () => {
            const userId = await insertUser();
            const friendA = await insertUser({ username: "FriendA" });
            const friendB = await insertUser({ username: "FriendB" });
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);

            await repo.setForUserSeasonId(userSeasonId, [friendB]);

            const result = await repo.getByUserSeasonIds([userSeasonId]);
            expect(result.get(userSeasonId).map((f) => f.username)).toEqual(["FriendB"]);
        });

        it("clears friends when given an empty list", async () => {
            const userId = await insertUser();
            const friendA = await insertUser();
            const showId = await insertShow();
            await insertSeason(showId, 1);
            await insertUserShow(userId, showId);
            const userSeasonId = await insertUserSeason(userId, showId, 1);
            await repo.setForUserSeasonId(userSeasonId, [friendA]);

            await repo.setForUserSeasonId(userSeasonId, []);

            const result = await repo.getByUserSeasonIds([userSeasonId]);
            expect(result.has(userSeasonId)).toBe(false);
        });

        it("getByUserSeasonIds returns an empty map for an empty list", async () => {
            const result = await repo.getByUserSeasonIds([]);

            expect(result.size).toBe(0);
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
