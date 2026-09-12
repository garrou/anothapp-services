import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import FriendRepository from "./friendRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("FriendRepository.checkIfRelationExists", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("returns true when a relation exists", async () => {
        db.query.mockResolvedValue({rows: [{total: "1"}]});

        const result = await repo.checkIfRelationExists("user-1", "user-2");

        expect(result).toBe(true);
    });

    it("returns false when no relation exists", async () => {
        db.query.mockResolvedValue({rows: [{total: "0"}]});

        const result = await repo.checkIfRelationExists("user-1", "user-2");

        expect(result).toBe(false);
    });
});

describe("FriendRepository.checkIfAlreadyFriend", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("returns true when already friends", async () => {
        db.query.mockResolvedValue({rows: [{total: "1"}]});

        const result = await repo.checkIfAlreadyFriend("user-1", "user-2");

        expect(result).toBe(true);
    });

    it("returns false when not friends", async () => {
        db.query.mockResolvedValue({rows: [{total: "0"}]});

        const result = await repo.checkIfAlreadyFriend("user-1", "user-2");

        expect(result).toBe(false);
    });
});

describe("FriendRepository.acceptFriend", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("returns true when the request was accepted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.acceptFriend("user-1", "user-2");

        expect(result).toBe(true);
    });

    it("returns false when no matching request existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.acceptFriend("user-1", "user-2");

        expect(result).toBe(false);
    });
});

describe("FriendRepository.getFriends", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("maps rows to UserProfile instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "user-2", email: "b@b.com", picture: null, username: "bob", createdAt: "2024-01-01"}]});

        const result = await repo.getFriends("user-1");

        expect(result).toEqual([{id: "user-2", picture: null, username: "bob", current: false, episodeTrackingEnabled: undefined, createdAt: "2024-01-01"}]);
    });
});

describe("FriendRepository.getFriendsRequestsSend", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("maps rows to UserProfile instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "user-2", picture: null, username: "bob"}]});

        const result = await repo.getFriendsRequestsSend("user-1");

        expect(result).toEqual([{id: "user-2", picture: null, username: "bob", current: false, episodeTrackingEnabled: undefined, createdAt: undefined}]);
    });
});

describe("FriendRepository.getFriendsWhoWatchSerie", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("maps rows to UserProfile instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "user-2", picture: null, username: "bob"}]});

        const result = await repo.getFriendsWhoWatchSerie("user-1", 10);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", 10]);
        expect(result).toEqual([{id: "user-2", picture: null, username: "bob", current: false, episodeTrackingEnabled: undefined, createdAt: undefined}]);
    });
});

describe("FriendRepository.getFriendsRequestsReceive", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("maps rows to UserProfile instances", async () => {
        db.query.mockResolvedValue({rows: [{id: "user-2", picture: null, username: "bob"}]});

        const result = await repo.getFriendsRequestsReceive("user-1");

        expect(result).toEqual([{id: "user-2", picture: null, username: "bob", current: false, episodeTrackingEnabled: undefined, createdAt: undefined}]);
    });
});

describe("FriendRepository.sendFriendRequest", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("returns true when the request was created", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.sendFriendRequest("user-1", "user-2");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO friends"), ["user-1", "user-2"]);
        expect(result).toBe(true);
    });
});

describe("FriendRepository.deleteFriend", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new FriendRepository();
    });

    it("returns the requester id and accepted state when deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{fst_user_id: "user-1", accepted: true}]});

        const result = await repo.deleteFriend("user-1", "user-2");

        expect(result).toEqual({requesterId: "user-1", wasAccepted: true});
    });

    it("returns null when no matching relation existed", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.deleteFriend("user-1", "user-2");

        expect(result).toBeNull();
    });
});
