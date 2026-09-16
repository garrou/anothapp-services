import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import ActorService from "../../../services/actorService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertActor } from "../fixtures.js";

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
            const actorId = await insertActor({ name: "Local Actor" });
            service._searchService.getPersonById = async () => { throw new Error("should not be called"); };

            const actor = await service.addFavorite(userId, actorId);

            expect(actor.name).toBe("Local Actor");
            const favorites = await service.getFavorites(userId);
            expect(favorites.map((a) => a.id)).toEqual([actorId]);
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
