import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import db from "../../../config/db.js";
import eventBus from "../../../helpers/eventBus.js";
import NotificationListener from "../../../services/notificationListener.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertPlaylist } from "../fixtures.js";

// Same singleton-eventBus caveat as achievementListener.pg.test.js: construct once for the whole
// file so repeated `new NotificationListener()` calls don't stack duplicate listeners.
describe("NotificationListener (real Postgres)", () => {
    beforeAll(() => {
        new NotificationListener();
    });

    beforeEach(async () => {
        await resetDb();
    });

    it("#notifyFriends notifies every accepted friend of the actor", async () => {
        const actorId = await insertUser();
        const friendA = await insertUser();
        const friendB = await insertUser();
        const strangerId = await insertUser();
        await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [actorId, friendA]);
        await db.query(`INSERT INTO friends (fst_user_id, sec_user_id, accepted) VALUES ($1, $2, TRUE)`, [friendB, actorId]);
        const showId = await insertShow();

        eventBus.emit("show.started", { actorUserId: actorId, showId });

        await vi.waitFor(async () => {
            const res = await db.query(`SELECT recipient_user_id FROM notifications WHERE type = 'show_started'`);
            expect(res.rows.map((r) => r["recipient_user_id"]).sort()).toEqual([friendA, friendB].sort());
        });
        const res = await db.query(`SELECT recipient_user_id FROM notifications WHERE type = 'show_started'`);
        expect(res.rows.map((r) => r["recipient_user_id"])).not.toContain(strangerId);
    });

    it("#notifyOne notifies only the given recipient", async () => {
        const actorId = await insertUser();
        const recipientId = await insertUser();

        eventBus.emit("friend.request", { recipientUserId: recipientId, actorUserId: actorId });

        await vi.waitFor(async () => {
            const res = await db.query(`SELECT recipient_user_id FROM notifications WHERE type = 'friend_request'`);
            expect(res.rows.map((r) => r["recipient_user_id"])).toEqual([recipientId]);
        });
    });

    it("#notifyList fans out to every explicit recipient", async () => {
        const actorId = await insertUser();
        const friendA = await insertUser();
        const friendB = await insertUser();
        const showId = await insertShow();

        eventBus.emit("season.watched_with", {
            actorUserId: actorId, recipientIds: [friendA, friendB], showId, metadata: { seasonNumber: 1 },
        });

        await vi.waitFor(async () => {
            const res = await db.query(`SELECT recipient_user_id FROM notifications WHERE type = 'season_watched_with'`);
            expect(res.rows.map((r) => r["recipient_user_id"]).sort()).toEqual([friendA, friendB].sort());
        });
    });

    it("carries playlist metadata through to the notification row", async () => {
        const ownerId = await insertUser();
        const collaboratorId = await insertUser();
        const playlistId = await insertPlaylist(ownerId, { name: "Shared List" });

        eventBus.emit("playlist.collaborator_invited", {
            recipientUserId: collaboratorId, actorUserId: ownerId,
            metadata: { playlistId, playlistName: "Shared List" },
        });

        await vi.waitFor(async () => {
            const res = await db.query(`SELECT metadata FROM notifications WHERE type = 'playlist_collaborator_invited'`);
            expect(res.rows[0]?.metadata).toEqual({ playlistId, playlistName: "Shared List" });
        });
    });
});
