import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import AchievementRepository from "./achievementRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("AchievementRepository.getTiers", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AchievementRepository();
    });

    it("maps rows to AchievementTier instances and caches them", async () => {
        db.query.mockResolvedValue({rows: [{code: "streak", league: 1, subTier: 1, threshold: "5"}]});

        const result = await repo.getTiers();

        expect(result).toEqual([{code: "streak", league: 1, subTier: 1, threshold: 5}]);

        db.query.mockClear();
        const cached = await repo.getTiers();

        expect(db.query).not.toHaveBeenCalled();
        expect(cached).toEqual(result);
    });
});

describe("AchievementRepository.getUserAchievements", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AchievementRepository();
    });

    it("returns a Map keyed by code", async () => {
        db.query.mockResolvedValue({
            rows: [{code: "streak", league: 1, subTier: 2, unlockedAt: "2024-01-01"}],
        });

        const result = await repo.getUserAchievements("user-1");

        expect(result).toBeInstanceOf(Map);
        expect(result.get("streak")).toEqual({code: "streak", league: 1, subTier: 2, unlockedAt: "2024-01-01"});
    });

    it("returns an empty Map when there are no achievements", async () => {
        db.query.mockResolvedValue({rows: []});

        const result = await repo.getUserAchievements("user-1");

        expect(result.size).toBe(0);
    });
});

describe("AchievementRepository.upsertUserAchievement", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new AchievementRepository();
    });

    it("returns true when the tier was raised", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.upsertUserAchievement("user-1", "streak", 2, 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_achievements"), ["user-1", "streak", 2, 1]);
        expect(result).toBe(true);
    });

    it("returns false when the tier was not raised", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.upsertUserAchievement("user-1", "streak", 1, 1);

        expect(result).toBe(false);
    });
});
