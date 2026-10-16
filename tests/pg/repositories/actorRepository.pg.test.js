import { describe, it, expect, beforeEach } from "vitest";
import ActorRepository from "../../../repositories/actorRepository.js";
import UserFavoriteActorRepository from "../../../repositories/userFavoriteActorRepository.js";
import { resetDb } from "../resetDb.js";
import { insertActor, insertUser } from "../fixtures.js";

describe("ActorRepository (real Postgres)", () => {
    /** @type {ActorRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new ActorRepository();
    });

    describe("createActor / getActorById", () => {
        it("creates an actor and retrieves it by id", async () => {
            const result = await repo.createActor(1, "Bryan Cranston", "pic.jpg", "1956-03-07", null, "American", "desc");

            expect(result).toBe(true);
            const actor = await repo.getActorById(1);
            expect(actor).toEqual({
                id: 1, name: "Bryan Cranston", picture: "pic.jpg",
                birthday: "1956-03-07", deathday: null, nationality: "American", description: "desc",
            });
        });

        it("returns null when the actor does not exist", async () => {
            const result = await repo.getActorById(9999);

            expect(result).toBeNull();
        });
    });

    describe("getAllActors", () => {
        it("returns every actor", async () => {
            await insertActor({ id: 1, name: "Actor A" });
            await insertActor({ id: 2, name: "Actor B" });

            const result = await repo.getAllActors();

            expect(result.map((a) => a.name).sort()).toEqual(["Actor A", "Actor B"]);
        });
    });

    describe("getFavoritedActors", () => {
        it("returns only actors favorited by at least one user", async () => {
            const favorited = await insertActor({ id: 1, name: "Favorited" });
            await insertActor({ id: 2, name: "Never favorited" });
            const userId = await insertUser();
            await new UserFavoriteActorRepository().create(userId, favorited);

            const result = await repo.getFavoritedActors();

            expect(result.map((a) => a.name)).toEqual(["Favorited"]);
        });

        it("returns each favorited actor only once even when several users favorited it", async () => {
            const favorited = await insertActor({ id: 1, name: "Favorited" });
            const userA = await insertUser();
            const userB = await insertUser();
            const favRepo = new UserFavoriteActorRepository();
            await favRepo.create(userA, favorited);
            await favRepo.create(userB, favorited);

            const result = await repo.getFavoritedActors();

            expect(result).toHaveLength(1);
        });
    });

    describe("updateActor", () => {
        it("updates the actor's fields", async () => {
            await insertActor({ id: 1, name: "Original", nationality: "French" });

            const result = await repo.updateActor(1, {
                name: "Updated", picture: "new.jpg", birthday: null, deathday: null,
                nationality: "American", description: "new desc",
            });

            expect(result).toBe(true);
            const actor = await repo.getActorById(1);
            expect(actor.name).toBe("Updated");
            expect(actor.nationality).toBe("American");
        });

        it("returns false when the actor does not exist", async () => {
            const result = await repo.updateActor(9999, {
                name: "X", picture: null, birthday: null, deathday: null, nationality: null, description: null,
            });

            expect(result).toBe(false);
        });
    });
});
