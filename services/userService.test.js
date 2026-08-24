import { describe, it, expect, vi, beforeEach } from "vitest";
import UserService from "./userService.js";
import UserUpdate from "../models/userUpdate.js";

const userRepoMocks = vi.hoisted(() => ({
    updateField: vi.fn(),
}));
const episodeServiceMocks = vi.hoisted(() => ({
    backfillForUser: vi.fn(),
}));

vi.mock("../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("./episodeService.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeServiceMocks; }),
}));

describe("UserService.updateUser - episode tracking", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
    });

    it("enables the flag and triggers a backfill of the existing history", async () => {
        userRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser("user-1", new UserUpdate({ episodeTrackingEnabled: true }));

        expect(userRepoMocks.updateField).toHaveBeenCalledWith("user-1", "episode_tracking_enabled", true);
        expect(episodeServiceMocks.backfillForUser).toHaveBeenCalledWith("user-1");
        expect(message).toBe("Suivi des épisodes activé");
    });

    it("disables the flag without triggering a backfill", async () => {
        userRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser("user-1", new UserUpdate({ episodeTrackingEnabled: false }));

        expect(episodeServiceMocks.backfillForUser).not.toHaveBeenCalled();
        expect(message).toBe("Suivi des épisodes désactivé");
    });

    it("throws a 500 when the update fails in the database", async () => {
        userRepoMocks.updateField.mockResolvedValue(false);

        await expect(
            userService.updateUser("user-1", new UserUpdate({ episodeTrackingEnabled: true }))
        ).rejects.toThrow("Impossible de modifier le suivi des épisodes");
        expect(episodeServiceMocks.backfillForUser).not.toHaveBeenCalled();
    });
});
