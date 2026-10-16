import { describe, it, expect, beforeEach, afterEach } from "vitest";
import db from "../../../config/db.js";
import ShowRepository from "../../../repositories/showRepository.js";
import { resetDb } from "../resetDb.js";
import { insertShow, insertActor, insertShowActor } from "../fixtures.js";

describe("ShowRepository (real Postgres)", () => {
    /** @type {ShowRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new ShowRepository();
    });

    afterEach(async () => {
        await db.query(`DELETE FROM kinds WHERE id LIKE 'Existing_%'`);
    });

    describe("isNewShow", () => {
        it("returns true when the show does not exist yet", async () => {
            const result = await repo.isNewShow(123);

            expect(result).toBe(true);
        });

        it("returns false when the show already exists", async () => {
            const showId = await insertShow();

            const result = await repo.isNewShow(showId);

            expect(result).toBe(false);
        });
    });

    describe("createShow / getShow", () => {
        it("creates a show along with its kinds", async () => {
            const result = await repo.createShow(
                1, "Breaking Bad", "poster.jpg", [{ id: "Drama", name: "Drame" }, { id: "Crime", name: "Crime" }],
                45, 5, "US", "desc", 2008, "AMC", "en", 62
            );

            expect(result).toBe(true);
            const show = await repo.getShow(1);
            expect(show.title).toBe("Breaking Bad");
            expect(show.kinds.sort()).toEqual(["Crime", "Drame"]);
        });

        it("reuses an existing kind by name instead of creating a duplicate", async () => {
            await db.query(`INSERT INTO kinds (id, name) VALUES ('Existing_CustomKind', 'CustomKindName')`);

            await repo.createShow(1, "Show", null, [{ id: "Different_Id", name: "CustomKindName" }], 30, 1, "FR", null, null, null, null, null);

            const kinds = await db.query(`SELECT id FROM kinds WHERE name = 'CustomKindName'`);
            expect(kinds.rowCount).toBe(1);
            expect(kinds.rows[0].id).toBe("Existing_CustomKind");
            const showKinds = await db.query(`SELECT kind_id FROM shows_kinds WHERE show_id = 1`);
            expect(showKinds.rows[0]["kind_id"]).toBe("Existing_CustomKind");
        });

        it("collapses two Betaseries keys sharing the same known display name into a single kind, without duplicate-key errors", async () => {
            // Betaseries is inconsistent about genre keys: the same displayed name ("Science-fiction")
            // can come back under different ids within one show's genre list (e.g. "Science_Fiction"
            // and "Science Fiction"). Both resolve, via existingIdByName, to the SAME already-known
            // kind id - without collapsing resolvedIds to a Set before inserting, that would produce
            // two identical (show_id, kind_id) rows in the same INSERT, violating shows_kinds'
            // PRIMARY KEY(show_id, kind_id).
            await db.query(`INSERT INTO kinds (id, name) VALUES ('Existing_SciFi', 'Science-fiction custom')`);

            const result = await repo.createShow(1, "Show", null, [
                { id: "Science_Fiction", name: "Science-fiction custom" },
                { id: "Science Fiction", name: "Science-fiction custom" },
            ], 30, 1, "FR", null, null, null, null, null);

            expect(result).toBe(true);
            const showKinds = await db.query(`SELECT kind_id FROM shows_kinds WHERE show_id = 1`);
            expect(showKinds.rows).toEqual([{ kind_id: "Existing_SciFi" }]);
            const kinds = await db.query(`SELECT id FROM kinds WHERE name = 'Science-fiction custom'`);
            expect(kinds.rowCount).toBe(1);
        });

        it("does not crash when the raw kinds array contains a literal duplicate id", async () => {
            const result = await repo.createShow(1, "Show", null, [
                { id: "Drama", name: "Drame" },
                { id: "Drama", name: "Drame" },
            ], 30, 1, "FR", null, null, null, null, null);

            expect(result).toBe(true);
            const showKinds = await db.query(`SELECT kind_id FROM shows_kinds WHERE show_id = 1`);
            expect(showKinds.rows).toEqual([{ kind_id: "Drama" }]);
        });

        it("getShow returns null for an unknown show", async () => {
            const result = await repo.getShow(9999);

            expect(result).toBeNull();
        });
    });

    describe("setKinds", () => {
        it("replaces the show's kinds", async () => {
            const showId = await insertShow();
            await repo.setKinds(showId, [{ id: "Drama", name: "Drame" }]);

            await repo.setKinds(showId, [{ id: "Comedy", name: "Comédie" }]);

            const show = await repo.getShow(showId);
            expect(show.kinds).toEqual(["Comédie"]);
        });

        it("clears kinds when given an empty list", async () => {
            const showId = await insertShow();
            await repo.setKinds(showId, [{ id: "Drama", name: "Drame" }]);

            await repo.setKinds(showId, []);

            const show = await repo.getShow(showId);
            expect(show.kinds).toEqual([]);
        });
    });

    describe("getAllShows", () => {
        it("returns every show", async () => {
            await insertShow({ title: "A" });
            await insertShow({ title: "B" });

            const result = await repo.getAllShows();

            expect(result.map((s) => s.title).sort()).toEqual(["A", "B"]);
        });
    });

    describe("updateShow", () => {
        it("updates the show's fields and kinds", async () => {
            const showId = await insertShow({ title: "Original" });

            const result = await repo.updateShow(showId, {
                poster: "new.jpg", kinds: [{ id: "Horror", name: "Horreur" }],
                duration: 60, seasons: 2, country: "FR", finished: true, nextEpisode: null,
                description: "updated", creation: 2020, network: "TF1", language: "fr", episodes: 20,
            });

            expect(result).toBe(true);
            const show = await repo.getShow(showId);
            expect(show.poster).toBe("new.jpg");
            expect(show.kinds).toEqual(["Horreur"]);
        });

        it("returns false when the show does not exist", async () => {
            const result = await repo.updateShow(9999, {
                poster: null, kinds: [], duration: 30, seasons: 1, country: "FR", finished: false,
                nextEpisode: null, description: null, creation: null, network: null, language: null, episodes: null,
            });

            expect(result).toBe(false);
        });
    });

    describe("deleteShow", () => {
        it("deletes the show", async () => {
            const showId = await insertShow();

            const result = await repo.deleteShow(showId);

            expect(result).toBe(true);
            expect(await repo.getShow(showId)).toBeNull();
        });

        it("returns false when the show does not exist", async () => {
            const result = await repo.deleteShow(9999);

            expect(result).toBe(false);
        });
    });

    describe("needsCastSync / getShowIdsNeedingCastSync / setCast", () => {
        it("needs a sync for a show that has never had its cast imported", async () => {
            const showId = await insertShow();

            expect(await repo.needsCastSync(showId)).toBe(true);
            expect(await repo.getShowIdsNeedingCastSync(10)).toContain(showId);
        });

        it("returns false for a show outside our catalog", async () => {
            expect(await repo.needsCastSync(9999)).toBe(false);
        });

        it("stores the cast, creates missing actors and marks the show as synced", async () => {
            const showId = await insertShow();
            const existingActorId = await insertActor({ name: "Existing Actor" });

            await repo.setCast(showId, [
                { id: existingActorId, actor: "Existing Actor", picture: "existing.jpg" },
                { id: 999001, actor: "New Actor", picture: "new.jpg" },
            ]);

            const res = await db.query(`SELECT actor_id FROM shows_actors WHERE show_id = $1 ORDER BY actor_id`, [showId]);
            expect(res.rows.map((r) => r.actor_id).sort((a, b) => a - b)).toEqual([existingActorId, 999001].sort((a, b) => a - b));
            const newActor = await db.query(`SELECT name FROM actors WHERE id = 999001`);
            expect(newActor.rows[0].name).toBe("New Actor");
            expect(await repo.needsCastSync(showId)).toBe(false);
        });

        it("does not overwrite an actor's existing profile when it's already richer than the cast data", async () => {
            const showId = await insertShow();
            const actorId = await insertActor({ name: "Existing Actor", nationality: "FR" });

            await repo.setCast(showId, [{ id: actorId, actor: "Existing Actor", picture: "from-cast.jpg" }]);

            const res = await db.query(`SELECT nationality FROM actors WHERE id = $1`, [actorId]);
            expect(res.rows[0].nationality).toBe("FR");
        });

        it("replaces a show's previous cast rather than accumulating it", async () => {
            const showId = await insertShow();
            const oldActorId = await insertActor();
            await insertShowActor(showId, oldActorId);

            await repo.setCast(showId, [{ id: 999002, actor: "New Actor", picture: null }]);

            const res = await db.query(`SELECT actor_id FROM shows_actors WHERE show_id = $1`, [showId]);
            expect(res.rows.map((r) => r.actor_id)).toEqual([999002]);
        });

        it("still marks the show as synced when the cast is empty", async () => {
            const showId = await insertShow();

            await repo.setCast(showId, []);

            expect(await repo.needsCastSync(showId)).toBe(false);
        });

        it("only returns shows whose cast has never been synced", async () => {
            const synced = await insertShow();
            const unsynced = await insertShow();
            await repo.setCast(synced, []);

            const result = await repo.getShowIdsNeedingCastSync(10);

            expect(result).toContain(unsynced);
            expect(result).not.toContain(synced);
        });
    });
});
