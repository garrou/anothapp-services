import { describe, it, expect, vi, beforeEach } from "vitest";
import anonymizeDeletedAccounts from "../../../../schedule/tasks/anonymizeDeletedAccounts.js";

const userRepoMocks = vi.hoisted(() => ({
    anonymizeEligibleAccounts: vi.fn(),
}));

vi.mock("../../../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));

describe("anonymizeDeletedAccounts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("anonymizes accounts past a 15-day grace period", async () => {
        userRepoMocks.anonymizeEligibleAccounts.mockResolvedValue(2);

        const result = await anonymizeDeletedAccounts();

        expect(userRepoMocks.anonymizeEligibleAccounts).toHaveBeenCalledWith(15);
        expect(result).toEqual({ anonymized: 2 });
    });
});
