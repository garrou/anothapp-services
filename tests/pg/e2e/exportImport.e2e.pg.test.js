import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import db from "../../../config/db.js";
import SecurityHelper from "../../../helpers/security.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason, insertEpisode, insertUserEpisode, insertActor, insertPlaylist } from "../fixtures.js";

// True end-to-end against the real Express app + real Postgres: exports user A's data over real
// HTTP, then re-imports that exact same JSON body onto a freshly created user B, and checks the
// data landed on B without ever touching B's own identity (username/email) or recreating A's friends.
describe("Export/import journey (real Postgres, real HTTP)", () => {
    /** @type {import("express").Express} */
    let app;

    beforeAll(async () => {
        process.env.JWT_SECRET = "test-secret";
        const module = await import("../../../config/app.js");
        app = module.default.app;
    });

    const sessionFor = (userId) => `access_token=${SecurityHelper.signJwt(userId, "test-secret")}`;

    it("recreates show/season/episode/playlist/actor/platform data on a new account, leaving its identity and friends untouched", async () => {
        await resetDb();

        const userA = await insertUser({ username: "Exporter", email: "exporter@test.fr" });
        const showId = await insertShow({ title: "Dark", duration: 45 });
        await insertSeason(showId, 1, { episodes: 10, image: "s1.jpg" });
        await insertUserShow(userA, showId, { favorite: true });
        const userSeasonId = await insertUserSeason(userA, showId, 1);
        const episodeId = await insertEpisode(showId, 1, { title: "Pilot", length: 45, description: "ep desc" });
        await insertUserEpisode(userA, userSeasonId, episodeId);

        const actorId = await insertActor({ name: "Some Actor" });
        await db.query(`INSERT INTO users_favorite_actors (user_id, actor_id) VALUES ($1, $2)`, [userA, actorId]);
        await db.query(`INSERT INTO users_platforms (user_id, platform_id) VALUES ($1, 1)`, [userA]);

        const playlistId = await insertPlaylist(userA, { name: "My playlist" });
        await db.query(`INSERT INTO playlists_shows (playlist_id, show_id) VALUES ($1, $2)`, [playlistId, showId]);

        const friendId = await insertUser();
        await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [userA, friendId]);

        const exportRes = await request(app).get("/settings/export-data").set("Cookie", sessionFor(userA));
        expect(exportRes.status).toBe(200);

        const userB = await insertUser({ username: "Importer", email: "importer@test.fr" });

        const importRes = await request(app)
            .post("/settings/import-data")
            .set("Cookie", sessionFor(userB))
            .send(exportRes.body);

        expect(importRes.status).toBe(200);
        expect(importRes.body.shows).toEqual({ imported: 1, errors: 0 });
        expect(importRes.body.playlists).toEqual({ imported: 1, errors: 0 });
        expect(importRes.body.favoriteActors).toEqual({ imported: 1, errors: 0 });
        expect(importRes.body.platforms).toEqual({ imported: 1, errors: 0 });

        const userShow = await db.query(`SELECT * FROM users_shows WHERE user_id = $1 AND show_id = $2`, [userB, showId]);
        expect(userShow.rows[0].favorite).toBe(true);

        const userSeason = await db.query(`SELECT * FROM users_seasons WHERE user_id = $1 AND show_id = $2`, [userB, showId]);
        expect(userSeason.rows).toHaveLength(1);

        const userEpisode = await db.query(`
            SELECT ue.* FROM users_episodes ue
            JOIN users_seasons us ON us.id = ue.users_seasons_id
            WHERE us.user_id = $1 AND us.show_id = $2
        `, [userB, showId]);
        expect(userEpisode.rows).toHaveLength(1);

        const favoriteActor = await db.query(`SELECT * FROM users_favorite_actors WHERE user_id = $1 AND actor_id = $2`, [userB, actorId]);
        expect(favoriteActor.rows).toHaveLength(1);

        const platform = await db.query(`SELECT * FROM users_platforms WHERE user_id = $1 AND platform_id = 1`, [userB]);
        expect(platform.rows).toHaveLength(1);

        const playlist = await db.query(`SELECT * FROM playlists WHERE user_id = $1`, [userB]);
        expect(playlist.rows).toHaveLength(1);
        expect(playlist.rows[0].name).toBe("My playlist");

        // The target account's own identity is never touched by the import.
        const targetUser = await db.query(`SELECT username, email FROM users WHERE id = $1`, [userB]);
        expect(targetUser.rows[0].username).toBe("Importer");
        expect(targetUser.rows[0].email).toBe("importer@test.fr");

        // Friends are excluded from the import by design - they can't be recreated unilaterally.
        const friends = await db.query(`SELECT * FROM friends WHERE fst_user_id = $1 OR sec_user_id = $1`, [userB]);
        expect(friends.rows).toHaveLength(0);
    });

    it("rejects an import payload without a shows array", async () => {
        await resetDb();
        const userId = await insertUser();

        const res = await request(app).post("/settings/import-data").set("Cookie", sessionFor(userId)).send({});

        expect(res.status).toBe(400);
    });

    it("requires authentication", async () => {
        const res = await request(app).post("/settings/import-data").send({ shows: [] });

        expect(res.status).toBe(401);
    });
});
