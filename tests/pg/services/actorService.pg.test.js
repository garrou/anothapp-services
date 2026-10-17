import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import ActorService from "../../../services/actorService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertActor, insertShow } from "../fixtures.js";

describe("ActorService (real Postgres)", () => {
    /** @type {ActorService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new ActorService();
        // getPersonById hits the real Betaseries API - stub it out so only the DB paths are real.
        service._searchService.getPersonById = async (id) => ({
            id, name: "Fetched Actor", poster: "pic.jpg", birthday: null, deathday: null,
            nationality: "American", description: "desc",
        });
    });

    describe("addFavorite", () => {
        it("favorites an actor already known locally, without calling the external API", async () => {
            const userId = await insertUser();
            // A full profile, not a bare stub row - otherwise addFavorite would
            // (correctly) try to enrich it, which is exactly what the next test covers.
            const actorId = await insertActor({ name: "Local Actor", nationality: "French" });
            service._searchService.getPersonById = async () => { throw new Error("should not be called"); };

            const actor = await service.addFavorite(userId, actorId);

            expect(actor.name).toBe("Local Actor");
            const favorites = await service.getFavorites(userId);
            expect(favorites.map((a) => a.id)).toEqual([actorId]);
        });

        it("enriches a stub actor row (no profile data yet) instead of reusing its incomplete data", async () => {
            const userId = await insertUser();
            // No birthday/nationality/description - a bare-minimum row with nothing enriched yet.
            const actorId = await insertActor({ name: "Cast Only" });

            const actor = await service.addFavorite(userId, actorId);

            expect(actor.name).toBe("Fetched Actor");
            expect(actor.nationality).toBe("American");
            const res = await db.query(`SELECT name, nationality FROM actors WHERE id = $1`, [actorId]);
            expect(res.rows[0]).toEqual({ name: "Fetched Actor", nationality: "American" });
        });

        it("keeps a stub's existing picture when the search API's profile doesn't have one", async () => {
            const userId = await insertUser();
            const actorId = await insertActor({ name: "Cast Only", picture: "from-cast-import.jpg" });
            service._searchService.getPersonById = async (id) => ({
                id, name: "Fetched Actor", poster: undefined, birthday: null, deathday: null,
                nationality: "American", description: "desc",
            });

            const actor = await service.addFavorite(userId, actorId);

            expect(actor.picture).toBe("from-cast-import.jpg");
        });

        it("links the show the user favorited this actor from, even when the actor was already fully known", async () => {
            const userId = await insertUser();
            const actorId = await insertActor({ name: "Local Actor", nationality: "French" });
            const showId = await insertShow();
            service._searchService.getPersonById = async () => { throw new Error("should not be called"); };

            await service.addFavorite(userId, actorId, showId);

            const res = await db.query(`SELECT show_id FROM shows_actors WHERE actor_id = $1`, [actorId]);
            expect(res.rows.map((r) => r.show_id)).toEqual([showId]);
        });

        it("links the show even for a brand-new actor whose profile also needed fetching", async () => {
            const userId = await insertUser();
            const showId = await insertShow();

            await service.addFavorite(userId, 34100, showId);

            const res = await db.query(`SELECT show_id FROM shows_actors WHERE actor_id = 34100`);
            expect(res.rows.map((r) => r.show_id)).toEqual([showId]);
        });

        it("does not link any show when none is given", async () => {
            const userId = await insertUser();
            const actorId = await insertActor({ name: "Local Actor", nationality: "French" });
            service._searchService.getPersonById = async () => { throw new Error("should not be called"); };

            await service.addFavorite(userId, actorId);

            const res = await db.query(`SELECT show_id FROM shows_actors WHERE actor_id = $1`, [actorId]);
            expect(res.rows).toEqual([]);
        });

        it("does not fail when the given show isn't in our catalog", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();

            await expect(service.addFavorite(userId, actorId, 999999)).resolves.toBeDefined();
        });

        it("fetches and creates the actor when it is not known locally yet", async () => {
            const userId = await insertUser();

            const actor = await service.addFavorite(userId, 999999);

            expect(actor.name).toBe("Fetched Actor");
            const res = await db.query(`SELECT name FROM actors WHERE id = 999999`);
            expect(res.rows[0].name).toBe("Fetched Actor");
        });

        it("rejects favoriting the same actor twice", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();
            await service.addFavorite(userId, actorId);

            await expect(service.addFavorite(userId, actorId)).rejects.toMatchObject({ status: 409 });
        });

        it("rejects without an actor id", async () => {
            const userId = await insertUser();

            await expect(service.addFavorite(userId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("removeFavorite", () => {
        it("removes the favorite", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();
            await service.addFavorite(userId, actorId);

            await service.removeFavorite(userId, actorId);

            expect(await service.getFavorites(userId)).toEqual([]);
        });

        it("throws when there is nothing to remove", async () => {
            const userId = await insertUser();
            const actorId = await insertActor();

            await expect(service.removeFavorite(userId, actorId)).rejects.toMatchObject({ status: 500 });
        });
    });

    describe("getFavorites", () => {
        it("returns a friend's favorites when accepted friends", async () => {
            const userId = await insertUser();
            const friendId = await insertUser();
            await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userId, friendId]);
            const actorId = await insertActor();
            await service.addFavorite(friendId, actorId);

            const result = await service.getFavorites(userId, friendId);

            expect(result.map((a) => a.id)).toEqual([actorId]);
        });

        it("rejects when not friends", async () => {
            const userId = await insertUser();
            const strangerId = await insertUser();

            await expect(service.getFavorites(userId, strangerId)).rejects.toMatchObject({ status: 400 });
        });
    });
});
