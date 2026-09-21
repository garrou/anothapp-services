import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import UserSeasonFriendRepository from "../../../repositories/userSeasonFriendRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

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

    it("attaches each friend's watch-together status to their profile", async () => {
        db.query.mockResolvedValue({
            rows: [{users_season_id: 1, status_id: "accepted", id: "user-2", username: "bob", picture: null}],
        });

        const result = await repo.getByUserSeasonIds([1]);

        expect(result.get(1)[0].status).toBe("accepted");
    });
});

describe("UserSeasonFriendRepository.setForUserSeasonId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    /** @param {{friend_user_id: string, status_id: string|null}[]} currentRows */
    const mockCurrent = (currentRows) => {
        const client = {
            query: vi.fn((sql) => sql.includes("SELECT friend_user_id")
                ? Promise.resolve({rows: currentRows})
                : Promise.resolve({rowCount: 1})),
        };
        db.transaction.mockImplementation(async (callback) => callback(client));
        return client;
    };

    it("inserts a brand new friend id and reports it as newly invited", async () => {
        const client = mockCurrent([]);

        const invited = await repo.setForUserSeasonId(1, ["user-2"]);

        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_seasons_friends"), [1, "user-2"]);
        expect(invited).toEqual(["user-2"]);
    });

    it("marks a friend dropped from the list as declined instead of deleting the row", async () => {
        const client = mockCurrent([{friend_user_id: "user-2", status_id: "accepted"}]);

        const invited = await repo.setForUserSeasonId(1, []);

        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SET status_id = 'declined'"), [1, "user-2"]);
        expect(invited).toEqual([]);
    });

    it("does not touch a friend already declined and still absent from the list", async () => {
        const client = mockCurrent([{friend_user_id: "user-2", status_id: "declined"}]);

        await repo.setForUserSeasonId(1, []);

        expect(client.query).toHaveBeenCalledTimes(1);
    });

    it("resets a previously declined friend back to pending when re-added", async () => {
        const client = mockCurrent([{friend_user_id: "user-2", status_id: "declined"}]);

        const invited = await repo.setForUserSeasonId(1, ["user-2"]);

        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SET status_id = NULL"), [1, "user-2"]);
        expect(invited).toEqual(["user-2"]);
    });

    it("leaves an already accepted friend untouched when still present in the list", async () => {
        const client = mockCurrent([{friend_user_id: "user-2", status_id: "accepted"}]);

        const invited = await repo.setForUserSeasonId(1, ["user-2"]);

        expect(client.query).toHaveBeenCalledTimes(1);
        expect(invited).toEqual([]);
    });
});

describe("UserSeasonFriendRepository.getStatus", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("returns the status_id when a link exists", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{status_id: "accepted"}]});

        const result = await repo.getStatus(1, "user-2");

        expect(result).toBe("accepted");
    });

    it("returns undefined when no link exists", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getStatus(1, "user-2");

        expect(result).toBeUndefined();
    });
});

describe("UserSeasonFriendRepository.accept / decline", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("accept sets status to accepted and links the friend's viewing", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.accept(1, "user-2", 42);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status_id = 'accepted'"), [1, "user-2", 42]);
        expect(result).toBe(true);
    });

    it("decline sets status to declined and clears the linked viewing", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.decline(1, "user-2");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status_id = 'declined'"), [1, "user-2"]);
        expect(result).toBe(true);
    });
});

describe("UserSeasonFriendRepository.declineAllBetweenUsers", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("updates links between the two users in either direction", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.declineAllBetweenUsers("user-1", "user-2");

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", "user-2"]);
    });
});

describe("UserSeasonFriendRepository.hasConflictingLink", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("returns true when the viewing is already linked elsewhere", async () => {
        db.query.mockResolvedValue({rows: [{conflict: true}]});

        expect(await repo.hasConflictingLink(42)).toBe(true);
    });

    it("returns false when the viewing is free", async () => {
        db.query.mockResolvedValue({rows: [{conflict: false}]});

        expect(await repo.hasConflictingLink(42)).toBe(false);
    });
});

describe("UserSeasonFriendRepository.getPendingForUser", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("maps pending invitations", async () => {
        db.query.mockResolvedValue({
            rows: [{
                users_season_id: 1, show_id: 10, title: "Dexter", poster: "poster.jpg", number: 2,
                owner_id: "user-2", owner_username: "bob", owner_picture: null,
            }],
        });

        const result = await repo.getPendingForUser("user-1");

        expect(result).toEqual([{
            userSeasonId: 1, showId: 10, showTitle: "Dexter", showPoster: "poster.jpg", seasonNumber: 2,
            actor: {id: "user-2", username: "bob", picture: null},
        }]);
    });
});

describe("UserSeasonFriendRepository.getLinkedViewings", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserSeasonFriendRepository();
    });

    it("maps rows to id/userId pairs", async () => {
        db.query.mockResolvedValue({rows: [{id: 2, user_id: "user-2"}]});

        const result = await repo.getLinkedViewings(1);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [1]);
        expect(result).toEqual([{id: 2, userId: "user-2"}]);
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
