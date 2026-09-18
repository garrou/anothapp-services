import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import db from "../../../config/db.js";
import eventBus from "../../../helpers/eventBus.js";
import AchievementListener from "../../../services/achievementListener.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertSeason, insertUserShow, insertUserSeason } from "../fixtures.js";

// AchievementListener wires itself to the shared, module-level eventBus singleton in its
// constructor and never unregisters - constructing it once here (not per-test) keeps this file
// from stacking duplicate listeners onto that shared bus across every other test file that also
// imports eventBus in this same process.
describe("AchievementListener (real Postgres)", () => {
    beforeAll(() => {
        new AchievementListener();
    });

    beforeEach(async () => {
        await resetDb();
    });

    // eventBus.emit() fires listeners asynchronously (fire-and-forget) with no way to await
    // completion from the caller, so tests poll for the resulting DB write with vi.waitFor
    // instead of guessing a fixed delay - a hardcoded sleep was long enough locally but flaky
    // on slower/loaded CI runners.

    it("re-evaluates achievements for the actor on show.started", async () => {
        const userId = await insertUser();
        const showId = await insertShow();
        await insertUserShow(userId, showId);
        await insertUserShow(userId, await insertShow());
        await insertUserShow(userId, await insertShow());

        eventBus.emit("show.started", { actorUserId: userId, showId });

        await vi.waitFor(async () => {
            const res = await db.query(`SELECT * FROM users_achievements WHERE user_id = $1 AND code = 'shows_started'`, [userId]);
            expect(res.rowCount).toBe(1);
        });
    });

    it("fans out to both the actor and every tagged friend on season.watched_with", async () => {
        const userId = await insertUser();
        const friendId = await insertUser();
        const showId = await insertShow();
        await insertSeason(showId, 1);
        await insertUserShow(userId, showId);
        const userSeasonId = await insertUserSeason(userId, showId, 1);
        await db.query(`INSERT INTO users_seasons_friends (users_season_id, friend_user_id) VALUES ($1, $2)`, [userSeasonId, friendId]);

        eventBus.emit("season.watched_with", { actorUserId: userId, recipientIds: [friendId], showId, metadata: { seasonNumber: 1 } });

        await vi.waitFor(async () => {
            const res = await db.query(`SELECT user_id FROM users_achievements WHERE code = 'friends_watched_with' AND user_id = ANY($1)`, [[userId, friendId]]);
            expect(res.rows.map((r) => r["user_id"]).sort()).toEqual([userId, friendId].sort());
        });
    });
});
