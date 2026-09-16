import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import PlaylistService from "../../../services/playlistService.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertPlaylist, insertShow } from "../fixtures.js";

// addShow is a single atomic `INSERT ... ON CONFLICT (playlist_id, show_id) DO NOTHING`, not a
// check-then-insert - so unlike the friend request/refresh token races, this one doesn't need a
// forced interleaving to prove: real concurrent transactions (two users, or a doubled-up client
// retry, adding the same show to the same playlist at once) should never produce two rows or an
// unhandled error, only one true and one false.
describe("Concurrent playlist show additions (real Postgres)", () => {
    /** @type {PlaylistService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new PlaylistService();
    });

    it("only one of two simultaneous adds of the same show succeeds, the other gets a clean 400", async () => {
        const userId = await insertUser();
        const playlistId = await insertPlaylist(userId);
        const showId = await insertShow();

        const results = await Promise.allSettled([
            service.addShowToPlaylist(userId, playlistId, showId),
            service.addShowToPlaylist(userId, playlistId, showId),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((r) => r.status === "rejected");
        expect(rejected.reason).toMatchObject({ status: 400 });
        const rows = await db.query(`SELECT * FROM playlists_shows WHERE playlist_id = $1`, [playlistId]);
        expect(rows.rowCount).toBe(1);
    });
});
