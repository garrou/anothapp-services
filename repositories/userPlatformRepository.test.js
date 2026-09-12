import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserPlatformRepository from "./userPlatformRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("UserPlatformRepository.addUserPlatforms", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserPlatformRepository();
    });

    it("returns true when a row was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.addUserPlatforms("user-1", 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_platforms"), ["user-1", 1]);
        expect(result).toBe(true);
    });

    it("returns false when nothing was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.addUserPlatforms("user-1", 1);

        expect(result).toBe(false);
    });
});

describe("UserPlatformRepository.getUserPlatforms", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserPlatformRepository();
    });

    it("maps rows to their platform ids", async () => {
        db.query.mockResolvedValue({rows: [{id: 1}, {id: 2}]});

        const result = await repo.getUserPlatforms("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM platforms"), ["user-1"]);
        expect(result).toEqual([1, 2]);
    });

    it("returns an empty array when the user has no platforms", async () => {
        db.query.mockResolvedValue({rows: []});

        const result = await repo.getUserPlatforms("user-1");

        expect(result).toEqual([]);
    });
});

describe("UserPlatformRepository.deleteUserPlatforms", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserPlatformRepository();
    });

    it("returns true when a row was deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.deleteUserPlatforms("user-1", 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM users_platforms"), ["user-1", 1]);
        expect(result).toBe(true);
    });

    it("returns false when no matching row existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.deleteUserPlatforms("user-1", 1);

        expect(result).toBe(false);
    });
});
