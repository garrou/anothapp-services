import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import NotificationRepository from "../../../repositories/notificationRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser, insertShow, insertUserShow } from "../fixtures.js";

describe("NotificationRepository (real Postgres)", () => {
    /** @type {NotificationRepository} */
    let repo;

    beforeEach(async () => {
        await resetDb();
        repo = new NotificationRepository();
    });

    describe("create / getByUserId", () => {
        it("creates a notification with metadata and retrieves it", async () => {
            const recipientId = await insertUser();
            const actorId = await insertUser({ username: "actor_user" });

            const result = await repo.create(recipientId, actorId, "friend_request", null, { note: "hi" });

            expect(result).toBe(true);
            const notifications = await repo.getByUserId(recipientId);
            expect(notifications).toHaveLength(1);
            expect(notifications[0].type).toBe("friend_request");
            expect(notifications[0].actor).toMatchObject({ id: actorId, username: "actor_user" });
            expect(notifications[0].metadata).toEqual({ note: "hi" });
            expect(notifications[0].read).toBe(false);
        });

        it("joins in the show when show_id is set", async () => {
            const recipientId = await insertUser();
            const showId = await insertShow({ title: "Dark" });

            await repo.create(recipientId, null, "episode_upcoming", showId, null);

            const notifications = await repo.getByUserId(recipientId);
            expect(notifications[0].show).toMatchObject({ id: showId, title: "Dark" });
            expect(notifications[0].actor).toBeUndefined();
        });

        it("orders notifications most recent first and respects the limit", async () => {
            const recipientId = await insertUser();
            for (let i = 0; i < 3; i++) {
                await repo.create(recipientId, null, `type_${i}`, null, null);
            }

            const result = await repo.getByUserId(recipientId, 2);

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe("type_2");
            expect(result[1].type).toBe("type_1");
        });

        it("only returns notifications for the requesting user", async () => {
            const recipientId = await insertUser();
            const otherUserId = await insertUser();
            await repo.create(otherUserId, null, "friend_request", null, null);

            const result = await repo.getByUserId(recipientId);

            expect(result).toEqual([]);
        });
    });

    describe("markAsRead", () => {
        it("marks the notification as read", async () => {
            const recipientId = await insertUser();
            await repo.create(recipientId, null, "friend_request", null, null);
            const [notification] = await repo.getByUserId(recipientId);

            const result = await repo.markAsRead(recipientId, notification.id);

            expect(result).toBe(true);
            const [updated] = await repo.getByUserId(recipientId);
            expect(updated.read).toBe(true);
        });

        it("returns false for another user's notification", async () => {
            const recipientId = await insertUser();
            const otherUserId = await insertUser();
            await repo.create(recipientId, null, "friend_request", null, null);
            const [notification] = await repo.getByUserId(recipientId);

            const result = await repo.markAsRead(otherUserId, notification.id);

            expect(result).toBe(false);
        });

        it("returns false when the notification is already read", async () => {
            const recipientId = await insertUser();
            await repo.create(recipientId, null, "friend_request", null, null);
            const [notification] = await repo.getByUserId(recipientId);
            await repo.markAsRead(recipientId, notification.id);

            const result = await repo.markAsRead(recipientId, notification.id);

            expect(result).toBe(false);
        });
    });

    describe("markAllAsRead", () => {
        it("marks every unread notification of the user as read", async () => {
            const recipientId = await insertUser();
            await repo.create(recipientId, null, "type_a", null, null);
            await repo.create(recipientId, null, "type_b", null, null);

            await repo.markAllAsRead(recipientId);

            const notifications = await repo.getByUserId(recipientId);
            expect(notifications.every((n) => n.read)).toBe(true);
        });
    });

    describe("createUpcomingEpisodeReminders", () => {
        it("creates a reminder for every user continuing an unfinished show airing on that date", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ finished: false });
            await db.query(`UPDATE shows SET next_episode = '2026-01-05' WHERE id = $1`, [showId]);
            await insertUserShow(userId, showId, { continueWatching: true });

            const result = await repo.createUpcomingEpisodeReminders("2026-01-05");

            expect(result).toBe(1);
            const notifications = await repo.getByUserId(userId);
            expect(notifications).toHaveLength(1);
            expect(notifications[0].type).toBe("episode_upcoming");
        });

        it("does not duplicate a reminder already sent for the same date", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ finished: false });
            await db.query(`UPDATE shows SET next_episode = '2026-01-05' WHERE id = $1`, [showId]);
            await insertUserShow(userId, showId, { continueWatching: true });
            await repo.createUpcomingEpisodeReminders("2026-01-05");

            const result = await repo.createUpcomingEpisodeReminders("2026-01-05");

            expect(result).toBe(0);
            const notifications = await repo.getByUserId(userId);
            expect(notifications).toHaveLength(1);
        });

        it("skips users who stopped continuing the show", async () => {
            const userId = await insertUser();
            const showId = await insertShow({ finished: false });
            await db.query(`UPDATE shows SET next_episode = '2026-01-05' WHERE id = $1`, [showId]);
            await insertUserShow(userId, showId, { continueWatching: false });

            const result = await repo.createUpcomingEpisodeReminders("2026-01-05");

            expect(result).toBe(0);
        });
    });

    describe("deleteOlderThanDays", () => {
        it("deletes only notifications older than the given number of days", async () => {
            const recipientId = await insertUser();
            await repo.create(recipientId, null, "old", null, null);
            await repo.create(recipientId, null, "recent", null, null);
            await db.query(`UPDATE notifications SET created_at = NOW() - INTERVAL '10 days' WHERE type = 'old'`);

            const result = await repo.deleteOlderThanDays(5);

            expect(result).toBe(1);
            const remaining = await repo.getByUserId(recipientId);
            expect(remaining.map((n) => n.type)).toEqual(["recent"]);
        });
    });
});
