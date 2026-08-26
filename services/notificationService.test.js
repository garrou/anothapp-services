import { describe, it, expect, vi, beforeEach } from "vitest";
import NotificationService from "./notificationService.js";

const notificationRepoMocks = vi.hoisted(() => ({
    getByUserId: vi.fn(),
    getUnreadCountByUserId: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
}));

vi.mock("../repositories/notificationRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return notificationRepoMocks; }),
}));

describe("NotificationService", () => {
    let notificationService;

    beforeEach(() => {
        vi.clearAllMocks();
        notificationService = new NotificationService();
    });

    it("getNotifications delegates to the repository", async () => {
        notificationRepoMocks.getByUserId.mockResolvedValue(["notif-1"]);

        const result = await notificationService.getNotifications("user-1");

        expect(result).toEqual(["notif-1"]);
        expect(notificationRepoMocks.getByUserId).toHaveBeenCalledWith("user-1");
    });

    it("getUnreadCount delegates to the repository", async () => {
        notificationRepoMocks.getUnreadCountByUserId.mockResolvedValue(3);

        await expect(notificationService.getUnreadCount("user-1")).resolves.toBe(3);
    });

    it("markAsRead rejects with a 400 when no id is given", async () => {
        await expect(notificationService.markAsRead("user-1", undefined)).rejects.toThrow("Requête invalide");
        expect(notificationRepoMocks.markAsRead).not.toHaveBeenCalled();
    });

    it("markAsRead delegates to the repository, scoped to the caller", async () => {
        await notificationService.markAsRead("user-1", 7);

        expect(notificationRepoMocks.markAsRead).toHaveBeenCalledWith("user-1", 7);
    });

    it("markAllAsRead delegates to the repository", async () => {
        await notificationService.markAllAsRead("user-1");

        expect(notificationRepoMocks.markAllAsRead).toHaveBeenCalledWith("user-1");
    });
});
