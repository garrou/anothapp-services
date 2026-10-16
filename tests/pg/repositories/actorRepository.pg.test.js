import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import ActorRepository from "../../../repositories/actorRepository.js";
import UserFavoriteActorRepository from "../../../repositories/userFavoriteActorRepository.js";
import { resetDb } from "../resetDb.js";
import { insertActor, insertShow, insertUser } from "../fixtures.js";

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

    describe("linkShows", () => {
        it("links the actor to every given show that's already in our catalog", async () => {
            const actorId = await insertActor();
            const showId = await insertShow();

            await repo.linkShows(actorId, [showId, 999999]);

            const res = await db.query(`SELECT show_id FROM shows_actors WHERE actor_id = $1`, [actorId]);
            expect(res.rows.map((r) => r.show_id)).toEqual([showId]);
        });

        it("does nothing when there are no show ids", async () => {
            const actorId = await insertActor();

            await repo.linkShows(actorId, []);

            const res = await db.query(`SELECT show_id FROM shows_actors WHERE actor_id = $1`, [actorId]);
            expect(res.rows).toEqual([]);
        });

        it("does not fail when the link already exists", async () => {
            const actorId = await insertActor();
            const showId = await insertShow();
            await repo.linkShows(actorId, [showId]);

            await repo.linkShows(actorId, [showId]);

            const res = await db.query(`SELECT show_id FROM shows_actors WHERE actor_id = $1`, [actorId]);
            expect(res.rows).toHaveLength(1);
        });
    });

    describe("getFavoritedActorsByShowId", () => {
        it("returns actors linked to the show that this user favorited", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            const favorited = await insertActor({ name: "Favorited" });
            const notFavorited = await insertActor({ name: "Not favorited" });
            await repo.linkShows(favorited, [showId]);
            await repo.linkShows(notFavorited, [showId]);
            await new UserFavoriteActorRepository().create(userId, favorited);

            const result = await repo.getFavoritedActorsByShowId(userId, showId);

            expect(result.map((a) => a.name)).toEqual(["Favorited"]);
        });

        it("does not return an actor favorited by the user but not linked to this show", async () => {
            const userId = await insertUser();
            const showId = await insertShow();
            const favorited = await insertActor();
            await new UserFavoriteActorRepository().create(userId, favorited);

            const result = await repo.getFavoritedActorsByShowId(userId, showId);

            expect(result).toEqual([]);
        });

        it("does not return a favorite belonging to another user", async () => {
            const userId = await insertUser();
            const otherUserId = await insertUser();
            const showId = await insertShow();
            const favorited = await insertActor();
            await repo.linkShows(favorited, [showId]);
            await new UserFavoriteActorRepository().create(otherUserId, favorited);

            const result = await repo.getFavoritedActorsByShowId(userId, showId);

            expect(result).toEqual([]);
        });
    });
});
