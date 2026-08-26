import { describe, it, expect, vi, beforeEach } from "vitest";
import FriendService from "./friendService.js";

const friendRepoMocks = vi.hoisted(() => ({
    checkIfRelationExists: vi.fn(),
    acceptFriend: vi.fn(),
    getFriends: vi.fn(),
    getFriendsRequestsSend: vi.fn(),
    getFriendsRequestsReceive: vi.fn(),
    getFriendsWhoWatchSerie: vi.fn(),
    sendFriendRequest: vi.fn(),
    deleteFriend: vi.fn(),
}));
const eventBusMocks = vi.hoisted(() => ({
    emit: vi.fn(),
}));

vi.mock("../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));
vi.mock("../helpers/eventBus.js", () => ({
    default: eventBusMocks,
}));

describe("FriendService.sendFriendRequest", () => {
    let friendService;

    beforeEach(() => {
        vi.clearAllMocks();
        friendService = new FriendService();
    });

    it("rejects with a 400 when no target userId is given", async () => {
        await expect(friendService.sendFriendRequest("user-1", undefined)).rejects.toThrow(
            "Requête invalide"
        );
        expect(friendRepoMocks.checkIfRelationExists).not.toHaveBeenCalled();
    });

    it("rejects with a 409 when a relation already exists (pending or accepted)", async () => {
        friendRepoMocks.checkIfRelationExists.mockResolvedValue(true);

        await expect(friendService.sendFriendRequest("user-1", "user-2")).rejects.toThrow(
            "Vous êtes déjà en relation avec cet utilisateur"
        );
        expect(friendRepoMocks.sendFriendRequest).not.toHaveBeenCalled();
    });

    it("sends the request when no relation exists yet and notifies the target", async () => {
        friendRepoMocks.checkIfRelationExists.mockResolvedValue(false);
        friendRepoMocks.sendFriendRequest.mockResolvedValue(true);

        await expect(friendService.sendFriendRequest("user-1", "user-2")).resolves.toBeUndefined();
        expect(friendRepoMocks.sendFriendRequest).toHaveBeenCalledWith("user-1", "user-2");
        expect(eventBusMocks.emit).toHaveBeenCalledWith("friend.request", {
            recipientUserId: "user-2", actorUserId: "user-1",
        });
    });

    it("throws a 500 when the insert fails in the database", async () => {
        friendRepoMocks.checkIfRelationExists.mockResolvedValue(false);
        friendRepoMocks.sendFriendRequest.mockResolvedValue(false);

        await expect(friendService.sendFriendRequest("user-1", "user-2")).rejects.toThrow(
            "Impossible de demander cet utilisateur"
        );
    });
});

describe("FriendService.acceptFriend", () => {
    let friendService;

    beforeEach(() => {
        vi.clearAllMocks();
        friendService = new FriendService();
    });

    it("rejects with a 400 when bodyUserId is missing", async () => {
        await expect(friendService.acceptFriend("user-1", undefined, "user-2")).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("rejects with a 400 when bodyUserId doesn't match paramUserId (guards against accepting on someone else's behalf)", async () => {
        await expect(friendService.acceptFriend("user-1", "user-2", "user-3")).rejects.toThrow(
            "Requête invalide"
        );
        expect(friendRepoMocks.acceptFriend).not.toHaveBeenCalled();
    });

    it("accepts the request when bodyUserId matches paramUserId and notifies the original requester", async () => {
        friendRepoMocks.acceptFriend.mockResolvedValue(true);

        await expect(friendService.acceptFriend("user-1", "user-2", "user-2")).resolves.toBeUndefined();
        expect(friendRepoMocks.acceptFriend).toHaveBeenCalledWith("user-2", "user-1");
        expect(eventBusMocks.emit).toHaveBeenCalledWith("friend.accepted", {
            recipientUserId: "user-2", actorUserId: "user-1",
        });
    });

    it("throws a 500 when the update fails in the database", async () => {
        friendRepoMocks.acceptFriend.mockResolvedValue(false);

        await expect(friendService.acceptFriend("user-1", "user-2", "user-2")).rejects.toThrow(
            "Impossible d'accepter cette demande"
        );
    });
});

describe("FriendService.deleteFriend", () => {
    let friendService;

    beforeEach(() => {
        vi.clearAllMocks();
        friendService = new FriendService();
    });

    it("rejects with a 400 when no userId is given", async () => {
        await expect(friendService.deleteFriend("user-1", undefined)).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("throws a 500 when nothing was deleted", async () => {
        friendRepoMocks.deleteFriend.mockResolvedValue(null);

        await expect(friendService.deleteFriend("user-1", "user-2")).rejects.toThrow(
            "Impossible de supprimer cet ami"
        );
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("notifies the original requester when their pending request is declined", async () => {
        friendRepoMocks.deleteFriend.mockResolvedValue({requesterId: "user-2", wasAccepted: false});

        await expect(friendService.deleteFriend("user-1", "user-2")).resolves.toBeUndefined();
        expect(eventBusMocks.emit).toHaveBeenCalledWith("friend.declined", {
            recipientUserId: "user-2", actorUserId: "user-1",
        });
    });

    it("stays silent when cancelling your own pending sent request", async () => {
        friendRepoMocks.deleteFriend.mockResolvedValue({requesterId: "user-1", wasAccepted: false});

        await expect(friendService.deleteFriend("user-1", "user-2")).resolves.toBeUndefined();
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("stays silent when removing an already-accepted friendship", async () => {
        friendRepoMocks.deleteFriend.mockResolvedValue({requesterId: "user-2", wasAccepted: true});

        await expect(friendService.deleteFriend("user-1", "user-2")).resolves.toBeUndefined();
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });
});

describe("FriendService.getFriends", () => {
    let friendService;

    beforeEach(() => {
        vi.clearAllMocks();
        friendService = new FriendService();
    });

    it("delegates to getFriendsRequestsSend for status=sent", async () => {
        friendRepoMocks.getFriendsRequestsSend.mockResolvedValue(["sent-friend"]);

        const result = await friendService.getFriends("user-1", "sent");

        expect(result).toEqual(["sent-friend"]);
        expect(friendRepoMocks.getFriendsRequestsSend).toHaveBeenCalledWith("user-1");
    });

    it("delegates to getFriendsRequestsReceive for status=received", async () => {
        friendRepoMocks.getFriendsRequestsReceive.mockResolvedValue(["received-friend"]);

        const result = await friendService.getFriends("user-1", "received");

        expect(result).toEqual(["received-friend"]);
    });

    it("delegates to getFriends for status=friends", async () => {
        friendRepoMocks.getFriends.mockResolvedValue(["confirmed-friend"]);

        const result = await friendService.getFriends("user-1", "friends");

        expect(result).toEqual(["confirmed-friend"]);
    });

    it("rejects with a 400 for status=viewed without a showId", async () => {
        await expect(friendService.getFriends("user-1", "viewed", undefined)).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("delegates to getFriendsWhoWatchSerie for status=viewed with a showId", async () => {
        friendRepoMocks.getFriendsWhoWatchSerie.mockResolvedValue(["watcher"]);

        const result = await friendService.getFriends("user-1", "viewed", 42);

        expect(result).toEqual(["watcher"]);
        expect(friendRepoMocks.getFriendsWhoWatchSerie).toHaveBeenCalledWith("user-1", 42);
    });

    it("returns a grouped object (sent/received/friends) when no status is given", async () => {
        friendRepoMocks.getFriendsRequestsSend.mockResolvedValue(["sent-friend"]);
        friendRepoMocks.getFriendsRequestsReceive.mockResolvedValue(["received-friend"]);
        friendRepoMocks.getFriends.mockResolvedValue(["confirmed-friend"]);

        const result = await friendService.getFriends("user-1", undefined);

        expect(result).toEqual({
            sent: ["sent-friend"],
            received: ["received-friend"],
            friends: ["confirmed-friend"],
        });
    });
});