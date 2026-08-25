import { describe, it, expect, vi, beforeEach } from "vitest";
import UserPlatformService from "./userPlatformService.js";

const userPlatformRepoMocks = vi.hoisted(() => ({
    getUserPlatforms: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    checkIfAlreadyFriend: vi.fn(),
}));

vi.mock("../repositories/userPlatformRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userPlatformRepoMocks; }),
}));
vi.mock("../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));

describe("UserPlatformService.getUserPlatforms", () => {
    let userPlatformService;

    beforeEach(() => {
        vi.clearAllMocks();
        userPlatformService = new UserPlatformService();
    });

    it("returns the caller's own platforms when no friendId is given", async () => {
        userPlatformRepoMocks.getUserPlatforms.mockResolvedValue([1, 2]);

        const result = await userPlatformService.getUserPlatforms("user-1");

        expect(result).toEqual([1, 2]);
        expect(userPlatformRepoMocks.getUserPlatforms).toHaveBeenCalledWith("user-1");
        expect(friendRepoMocks.checkIfAlreadyFriend).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when friendId isn't actually a friend", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(
            userPlatformService.getUserPlatforms("user-1", "user-2")
        ).rejects.toThrow("Vous n'êtes pas en relation avec cette personne");
        expect(userPlatformRepoMocks.getUserPlatforms).not.toHaveBeenCalled();
    });

    it("returns the friend's platforms when friendId is a friend", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        userPlatformRepoMocks.getUserPlatforms.mockResolvedValue([3]);

        const result = await userPlatformService.getUserPlatforms("user-1", "user-2");

        expect(result).toEqual([3]);
        expect(userPlatformRepoMocks.getUserPlatforms).toHaveBeenCalledWith("user-2");
    });
});
