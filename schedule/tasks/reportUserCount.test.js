import {describe, it, expect, vi, beforeEach} from "vitest";
import reportUserCount from "./reportUserCount.js";

const userRepoMocks = vi.hoisted(() => ({
    getUserCount: vi.fn(),
}));

vi.mock("../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));

describe("reportUserCount", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the total number of users", async () => {
        userRepoMocks.getUserCount.mockResolvedValue(42);

        const result = await reportUserCount();

        expect(result).toEqual({total: 42});
    });
});
