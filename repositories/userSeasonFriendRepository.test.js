import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserSeasonFriendRepository from "./userSeasonFriendRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

const makeClient = () => ({query: vi.fn().mockResolvedValue({rowCount: 0, rows: []})});

describe("UserSeasonFriendRepository.getByUserSeasonIds", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("returns an empty Map without querying when ids is empty", async () => {
        const result = await repo.getByUserSeasonIds([]);

        expect(db.query).not.toHaveBeenCalled();
        expect(result.size).toBe(0);
    });

    it("groups friends by users_season_id", async () => {
        db.query.mockResolvedValue({
            rows: [
                {users_season_id: 1, id: "user-2", username: "bob", picture: null},
                {users_season_id: 1, id: "user-3", username: "alice", picture: null},
                {users_season_id: 2, id: "user-2", username: "bob", picture: null},
            ],
        });

        const result = await repo.getByUserSeasonIds([1, 2]);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [[1, 2]]);
        expect(result.get(1)).toHaveLength(2);
        expect(result.get(2)).toHaveLength(1);
        expect(result.get(1)[0].username).toBe("bob");
    });
});

describe("UserSeasonFriendRepository.setForUserSeasonId", () => {
    let repo;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
        client = makeClient();
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("deletes then inserts the new friend ids", async () => {
        await repo.setForUserSeasonId(1, ["user-2", "user-3"]);

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("DELETE FROM users_seasons_friends"), [1]);
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO users_seasons_friends"), [1, "user-2", "user-3"]);
    });

    it("only deletes when friendIds is empty", async () => {
        await repo.setForUserSeasonId(1, []);

        expect(client.query).toHaveBeenCalledTimes(1);
    });
});

describe("UserSeasonFriendRepository.getTopFriendsByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("maps rows to Stat instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "user-2", label: "bob", value: "12"}]});

        const result = await repo.getTopFriendsByUserId("user-1", 1);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 1]);
        expect(result).toEqual([{id: "user-2", label: "bob", value: 12}]);
    });

    it("defaults limit to 5", async () => {
        db.query.mockResolvedValue({rows: []});

        await repo.getTopFriendsByUserId("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 5]);
    });
});

describe("UserSeasonFriendRepository.getDistinctFriendsCountByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("returns the parsed count", async () => {
        db.query.mockResolvedValue({rows: [{total: "3"}]});

        const result = await repo.getDistinctFriendsCountByUserId("user-1");

        expect(result).toBe(3);
    });

    it("returns 0 when total is missing", async () => {
        db.query.mockResolvedValue({rows: [{total: undefined}]});

        const result = await repo.getDistinctFriendsCountByUserId("user-1");

        expect(result).toBe(0);
    });
});

describe("UserSeasonFriendRepository.getTopFriendByUserIdByYear", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("returns a Stat when found", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{id: "user-2", label: "bob", value: "8"}]});

        const result = await repo.getTopFriendByUserIdByYear("user-1", 2024);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 2024]);
        expect(result).toEqual({id: "user-2", label: "bob", value: 8});
    });

    it("returns null when no friend matched", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getTopFriendByUserIdByYear("user-1", 2024);

        expect(result).toBeNull();
    });
});
