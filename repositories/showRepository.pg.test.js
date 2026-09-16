import { describe, it, expect, beforeEach, afterEach } from "vitest";
import db from "../config/db.js";
import ShowRepository from "./showRepository.js";
import { resetDb } from "../tests/pg/resetDb.js";
import { insertShow } from "../tests/pg/fixtures.js";

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
});
