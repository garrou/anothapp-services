import { describe, it, expect, beforeEach } from "vitest";
import UserFavoriteActorRepository from "./userFavoriteActorRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import { insertUser, insertActor } from "../tests/pg/fixtures.js";

describe("UserFavoriteActorRepository (real Postgres)", () => {
    /** @type {UserFavoriteActorRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new UserFavoriteActorRepository();
    });

    describe("create / checkFavoriteExists", () => {
        it("adds an actor to a user's favorites", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();

            const result = await repo.create(userId, actorId);

            expect(result).toBe(true);
            expect(await repo.checkFavoriteExists(userId, actorId)).toBe(true);
        });

        it("checkFavoriteExists returns false when not favorited", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();

            const result = await repo.checkFavoriteExists(userId, actorId);

            expect(result).toBe(false);
        });
    });

    describe("deleteByUserIdActorId", () => {
        it("removes the favorite", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();
            await repo.create(userId, actorId);

            const result = await repo.deleteByUserIdActorId(userId, actorId);

            expect(result).toBe(true);
            expect(await repo.checkFavoriteExists(userId, actorId)).toBe(false);
        });

        it("returns false when the favorite does not exist", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();

            const result = await repo.deleteByUserIdActorId(userId, actorId);

            expect(result).toBe(false);
        });
    });

    describe("getCountByUserId", () => {
        it("counts only the requesting user's favorites", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const actorA = await insertActor();
            const actorB = await insertActor();
            await repo.create(userId, actorA);
            await repo.create(userId, actorB);
            await repo.create(otherUserId, actorA);

            const result = await repo.getCountByUserId(userId);

            expect(result).toBe(2);
        });

        it("returns 0 when the user has no favorites", async () => {
            const userId = await insertUser();

            const result = await repo.getCountByUserId(userId);

            expect(result).toBe(0);
        });
    });

    describe("getFavoritesByUserId", () => {
        it("returns the user's favorite actors, most recently added first", async () => {
            const userId = await insertUser();
            const first = await insertActor({ name: "First" });
            const second = await insertActor({ name: "Second" });
            await repo.create(userId, first);
            await new Promise((resolve) => setTimeout(resolve, 10));
            await repo.create(userId, second);

            const result = await repo.getFavoritesByUserId(userId);

            expect(result.map((a) => a.name)).toEqual(["Second", "First"]);
        });

        it("only returns the requesting user's own favorites", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const actorId = await insertActor();
            await repo.create(otherUserId, actorId);

            const result = await repo.getFavoritesByUserId(userId);

            expect(result).toEqual([]);
        });
    });
});
