import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserListRepository from "./userListRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("UserListRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserListRepository();
    });

    it("returns true when a row was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.create("user-1", 10);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_list"), ["user-1", 10]);
        expect(result).toBe(true);
    });
});

describe("UserListRepository.deleteByUserIdShowId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserListRepository();
    });

    it("returns true when a row was deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.deleteByUserIdShowId("user-1", 10);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM users_list"), ["user-1", 10]);
        expect(result).toBe(true);
    });

    it("returns false when no matching row existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.deleteByUserIdShowId("user-1", 999);

        expect(result).toBe(false);
    });
});

describe("UserListRepository.checkShowExistsByUserIdByShowId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserListRepository();
    });

    it("returns true when the show is in the list", async () => {
        db.query.mockResolvedValue({rows: [{total: "1"}]});

        const result = await repo.checkShowExistsByUserIdByShowId("user-1", 10);

        expect(result).toBe(true);
    });

    it("returns false when the show is not in the list", async () => {
        db.query.mockResolvedValue({rows: [{total: "0"}]});

        const result = await repo.checkShowExistsByUserIdByShowId("user-1", 999);

        expect(result).toBe(false);
    });
});

describe("UserListRepository.getListShowsByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserListRepository();
    });

    it("maps rows to Show instances", async () => {
        db.query.mockResolvedValue({
            rows: [{id: 10, title: "Show", poster: "poster.png", kind_names: ["Drame"], duration: 42, seasons: 1, country: "FR", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8}],
        });

        const result = await repo.getListShowsByUserId("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM shows"), ["user-1"]);
        expect(result).toEqual([{id: 10, title: "Show", poster: "poster.png", kinds: ["Drame"], duration: 42, seasons: 1, country: "FR", description: "desc", creation: 2020, network: "TF1", language: "fr", episodes: 8}]);
    });

    it("returns an empty array when the user's list is empty", async () => {
        db.query.mockResolvedValue({rows: []});

        const result = await repo.getListShowsByUserId("user-1");

        expect(result).toEqual([]);
    });
});
