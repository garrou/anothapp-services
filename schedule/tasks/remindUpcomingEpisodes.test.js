import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const notificationRepoMocks = vi.hoisted(() => ({
    createUpcomingEpisodeReminders: vi.fn(),
}));

vi.mock("../../repositories/notificationRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return notificationRepoMocks; }),
}));

describe("remindUpcomingEpisodes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-27T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("creates reminders for episodes airing tomorrow", async () => {
        notificationRepoMocks.createUpcomingEpisodeReminders.mockResolvedValue(3);
        const { default: remindUpcomingEpisodes } = await import("./remindUpcomingEpisodes.js");

        const result = await remindUpcomingEpisodes();

        expect(notificationRepoMocks.createUpcomingEpisodeReminders).toHaveBeenCalledWith("2026-08-28");
        expect(result).toEqual({ created: 3 });
    });
});
