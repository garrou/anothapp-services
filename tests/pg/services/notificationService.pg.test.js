import { describe, it, expect, beforeEach } from "vitest";
import NotificationService from "../../../services/notificationService.js";
import NotificationRepository from "../../../repositories/notificationRepository.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("NotificationService (real Postgres)", () => {
    /** @type {NotificationService} */
    let service;
    /** @type {NotificationRepository} */
    let notificationRepository;

    beforeEach(async () => {
        await resetDb();
        service = new NotificationService();
        notificationRepository = new NotificationRepository();
    });

    describe("getNotifications", () => {
        it("returns the user's notifications", async () => {
            const userId = await insertUser();
            await notificationRepository.create(userId, null, "friend_request", null, null);

            const result = await service.getNotifications(userId);

            expect(result).toHaveLength(1);
        });
    });

    describe("markAsRead", () => {
        it("marks a single notification as read", async () => {
            const userId = await insertUser();
            await notificationRepository.create(userId, null, "friend_request", null, null);
            const [notification] = await service.getNotifications(userId);

            await service.markAsRead(userId, notification.id);

            const [updated] = await service.getNotifications(userId);
            expect(updated.read).toBe(true);
        });

        it("throws 400 when no id is given", async () => {
            const userId = await insertUser();

            await expect(service.markAsRead(userId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("markAllAsRead", () => {
        it("marks every notification as read", async () => {
            const userId = await insertUser();
            await notificationRepository.create(userId, null, "type_a", null, null);
            await notificationRepository.create(userId, null, "type_b", null, null);

            await service.markAllAsRead(userId);

            const result = await service.getNotifications(userId);
            expect(result.every((n) => n.read)).toBe(true);
        });
    });
});
