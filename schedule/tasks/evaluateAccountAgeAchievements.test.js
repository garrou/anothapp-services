import { describe, it, expect, vi, beforeEach } from "vitest";
import evaluateAccountAgeAchievements from "./evaluateAccountAgeAchievements.js";

const userRepoMocks = vi.hoisted(() => ({
    getAllUserIds: vi.fn(),
}));
const achievementServiceMocks = vi.hoisted(() => ({
    evaluate: vi.fn(),
}));

vi.mock("../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../services/achievementService.js", () => ({
    default: vi.fn().mockImplementation(function () { return achievementServiceMocks; }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("evaluateAccountAgeAchievements", () => {
    it("evaluates only account_age for every existing user", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1", "user-2", "user-3"]);
        achievementServiceMocks.evaluate.mockResolvedValue(undefined);

        const result = await evaluateAccountAgeAchievements();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledTimes(3);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1", ["account_age"]);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-2", ["account_age"]);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-3", ["account_age"]);
        expect(result).toEqual({ evaluated: 3, total: 3, failed: [] });
    });

    it("reports a failure for one user without stopping the others", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1", "user-2"]);
        achievementServiceMocks.evaluate
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(undefined);

        const result = await evaluateAccountAgeAchievements();

        expect(result).toEqual({
            evaluated: 1,
            total: 2,
            failed: [{ userId: "user-1", error: "boom" }],
        });
    });

    it("is a no-op when there are no users", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue([]);

        const result = await evaluateAccountAgeAchievements();

        expect(achievementServiceMocks.evaluate).not.toHaveBeenCalled();
        expect(result).toEqual({ evaluated: 0, total: 0, failed: [] });
    });
});
