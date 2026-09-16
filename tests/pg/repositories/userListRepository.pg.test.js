import { describe, it, expect, beforeEach } from "vitest";
import UserListRepository from "../../../repositories/userListRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow } from "../fixtures.js";
import db from "../../../config/db.js";

describe("UserListRepository (real Postgres)", () => {
    /** @type {UserListRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserListRepository();
    });

    describe("create / checkShowExistsByUserIdByShowId", () => {
        it("adds a show to the user's list", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            const result = await repo.create(userId, showId);

            expect(result).toBe(true);
            expect(await repo.checkShowExistsByUserIdByShowId(userId, showId)).toBe(true);
        });

        it("checkShowExistsByUserIdByShowId returns false when absent", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            const result = await repo.checkShowExistsByUserIdByShowId(userId, showId);

            expect(result).toBe(false);
        });
    });

    describe("deleteByUserIdShowId", () => {
        it("removes the show from the user's list", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            await repo.create(userId, showId);

            const result = await repo.deleteByUserIdShowId(userId, showId);

            expect(result).toBe(true);
            expect(await repo.checkShowExistsByUserIdByShowId(userId, showId)).toBe(false);
        });

        it("returns false when the show is not in the list", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            const result = await repo.deleteByUserIdShowId(userId, showId);

            expect(result).toBe(false);
        });
    });

    describe("getListShowsByUserId", () => {
        it("returns the user's listed shows with their kinds", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ title: "Breaking Bad" });
            await db.query(`INSERT INTO shows_kinds (show_id, kind_id) VALUES ($1, 'Drama'), ($1, 'Crime')`, [showId]);
            await repo.create(userId, showId);

            const result = await repo.getListShowsByUserId(userId);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe("Breaking Bad");
            expect(result[0].kinds.sort()).toEqual(["Crime", "Drame"]);
        });

        it("only returns the requesting user's own list", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            await repo.create(otherUserId, showId);

            const result = await repo.getListShowsByUserId(userId);

            expect(result).toEqual([]);
        });
    });
});
