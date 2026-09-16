import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import db from "../../../config/db.js";
import SecurityHelper from "../../../helpers/security.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason } from "../fixtures.js";

// True end-to-end against the real Express app + real Postgres, like auth.e2e.pg.test.js. Login
// itself is already covered there, so here the session cookie is minted directly with
// SecurityHelper.signJwt - exactly what a real login would leave behind, without re-spending that
// file's separately-budgeted rate limit. Shows/seasons are pre-seeded in the DB so ensureShowExists
// never needs the real Betaseries API.
describe("Shows, seasons and stats journey (real Postgres, real HTTP)", () => {
    /** @type {import("express").Express} */
    let app;

    beforeAll(async () => {
        process.env.JWT_SECRET = "test-secret";
        const module = await import("../../../config/app.js");
        app = module.default.app;
    });

    const sessionFor = (userId) => `access_token=${SecurityHelper.signJwt(userId, "test-secret")}`;

    it("adds a show, adds a season, updates it, and sees it all reflected in stats and GET responses", async () => {
        await resetDb();
        const userId = await insertUser();
        const showId = await insertShow({ title: "Dark", duration: 45 });
        await insertSeason(showId, 1, { episodes: 10 });
        const cookie = sessionFor(userId);

        const addShowRes = await request(app).post("/shows").set("Cookie", cookie).send({ id: showId });
        expect(addShowRes.status).toBe(201);
        expect(addShowRes.body.title).toBe("Dark");

        const getShowRes = await request(app).get(`/shows/${showId}`).set("Cookie", cookie);
        expect(getShowRes.status).toBe(200);
        expect(getShowRes.body.serie.id).toBe(showId);

        const addSeasonRes = await request(app).post(`/shows/${showId}/seasons`).set("Cookie", cookie).send({ id: showId, num: 1 });
        expect(addSeasonRes.status).toBe(201);

        const favoriteRes = await request(app).patch(`/shows/${showId}`).set("Cookie", cookie).send({ favorite: true });
        expect(favoriteRes.status).toBe(200);
        expect(favoriteRes.body.value).toBe(true);

        const statsRes = await request(app).get("/stats").set("Cookie", cookie);
        expect(statsRes.status).toBe(200);
        expect(statsRes.body.nbSeries).toBe(1);
        expect(statsRes.body.nbSeasons).toBe(1);

        const listRes = await request(app).get("/shows").set("Cookie", cookie);
        expect(listRes.status).toBe(200);
        expect(listRes.body).toHaveLength(1);
        expect(listRes.body[0].favorite).toBe(true);
    });

    it("rejects adding a show already in the collection", async () => {
        await resetDb();
        const userId = await insertUser();
        const showId = await insertShow();
        const cookie = sessionFor(userId);
        await request(app).post("/shows").set("Cookie", cookie).send({ id: showId });

        const res = await request(app).post("/shows").set("Cookie", cookie).send({ id: showId });

        expect(res.status).toBe(409);
    });

    it("removes a show from the collection", async () => {
        await resetDb();
        const userId = await insertUser();
        const showId = await insertShow();
        const cookie = sessionFor(userId);
        await request(app).post("/shows").set("Cookie", cookie).send({ id: showId });

        const res = await request(app).delete(`/shows/${showId}`).set("Cookie", cookie);

        expect(res.status).toBe(204);
        const check = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [userId, showId]);
        expect(check.rowCount).toBe(0);
    });

    it("scopes shows and stats to the requesting user only", async () => {
        await resetDb();
        const userId = await insertUser();
        const otherUserId = await insertUser();
        const showId = await insertShow();
        await request(app).post("/shows").set("Cookie", sessionFor(otherUserId)).send({ id: showId });

        const listRes = await request(app).get("/shows").set("Cookie", sessionFor(userId));
        const statsRes = await request(app).get("/stats").set("Cookie", sessionFor(userId));

        expect(listRes.body).toEqual([]);
        expect(statsRes.body.nbSeries).toBe(0);
    });
});
