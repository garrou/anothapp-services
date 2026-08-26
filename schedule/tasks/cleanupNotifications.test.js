import { describe, it, expect, vi, beforeEach } from "vitest";

const notificationRepoMocks = vi.hoisted(() => ({
    deleteOlderThanDays: vi.fn(),
}));

vi.mock("../../repositories/notificationRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return notificationRepoMocks; }),
}));

describe("cleanupNotifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.NOTIFICATION_RETENTION_DAYS;
    });

    it("defaults to a 30-day retention when the env var isn't set", async () => {
        notificationRepoMocks.deleteOlderThanDays.mockResolvedValue(4);
        const { default: cleanupNotifications } = await import("./cleanupNotifications.js");

        const result = await cleanupNotifications();

        expect(notificationRepoMocks.deleteOlderThanDays).toHaveBeenCalledWith(30);
        expect(result).toEqual({ deleted: 4 });
    });

    it("honors NOTIFICATION_RETENTION_DAYS when set", async () => {
        process.env.NOTIFICATION_RETENTION_DAYS = "90";
        notificationRepoMocks.deleteOlderThanDays.mockResolvedValue(0);
        const { default: cleanupNotifications } = await import("./cleanupNotifications.js");

        await cleanupNotifications();

        expect(notificationRepoMocks.deleteOlderThanDays).toHaveBeenCalledWith(90);
    });
});
