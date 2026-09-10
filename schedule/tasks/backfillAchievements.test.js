import { describe, it, expect, vi, beforeEach } from "vitest";
import backfillAchievements from "./backfillAchievements.js";

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

describe("backfillAchievements", () => {
    it("evaluates every existing user", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1", "user-2", "user-3"]);
        achievementServiceMocks.evaluate.mockResolvedValue(undefined);

        const result = await backfillAchievements();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledTimes(3);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1");
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-2");
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-3");
        expect(result).toEqual({ evaluated: 3, total: 3, failed: [] });
    });

    it("reports a failure for one user without stopping the others", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue(["user-1", "user-2"]);
        achievementServiceMocks.evaluate
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(undefined);

        const result = await backfillAchievements();

        expect(result).toEqual({
            evaluated: 1,
            total: 2,
            failed: [{ userId: "user-1", error: "boom" }],
        });
    });

    it("is a no-op when there are no users", async () => {
        userRepoMocks.getAllUserIds.mockResolvedValue([]);

        const result = await backfillAchievements();

        expect(achievementServiceMocks.evaluate).not.toHaveBeenCalled();
        expect(result).toEqual({ evaluated: 0, total: 0, failed: [] });
    });
});
