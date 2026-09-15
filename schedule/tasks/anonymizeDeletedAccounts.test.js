import { describe, it, expect, vi, beforeEach } from "vitest";

const userRepoMocks = vi.hoisted(() => ({
    anonymizeEligibleAccounts: vi.fn(),
}));

vi.mock("../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));

describe("anonymizeDeletedAccounts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.DELETION_GRACE_DAYS;
    });

    it("defaults to a 30-day grace period when the env var isn't set", async () => {
        userRepoMocks.anonymizeEligibleAccounts.mockResolvedValue(2);
        const { default: anonymizeDeletedAccounts } = await import("./anonymizeDeletedAccounts.js");

        const result = await anonymizeDeletedAccounts();

        expect(userRepoMocks.anonymizeEligibleAccounts).toHaveBeenCalledWith(30);
        expect(result).toEqual({ anonymized: 2 });
    });

    it("honors DELETION_GRACE_DAYS when set", async () => {
        process.env.DELETION_GRACE_DAYS = "7";
        userRepoMocks.anonymizeEligibleAccounts.mockResolvedValue(0);
        const { default: anonymizeDeletedAccounts } = await import("./anonymizeDeletedAccounts.js");

        await anonymizeDeletedAccounts();

        expect(userRepoMocks.anonymizeEligibleAccounts).toHaveBeenCalledWith(7);
    });
});
