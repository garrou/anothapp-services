import { describe, it, expect, vi, beforeEach } from "vitest";
import eventBus from "../helpers/eventBus.js";
import NotificationListener from "./notificationListener.js";

const notificationRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    getFriends: vi.fn(),
}));

vi.mock("../repositories/notificationRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return notificationRepoMocks; }),
}));
vi.mock("../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));

// eventBus.emit() fires listeners as detached microtasks (see helpers/eventBus.js)
// so a listener's async work needs a tick to run before we can assert on it.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("NotificationListener", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.removeAllListeners();
        new NotificationListener();
    });

    it("fans out a friend-scoped event to every accepted friend", async () => {
        friendRepoMocks.getFriends.mockResolvedValue([{ id: "friend-1" }, { id: "friend-2" }]);

        eventBus.emit("show.started", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(friendRepoMocks.getFriends).toHaveBeenCalledWith("user-1");
        expect(notificationRepoMocks.create).toHaveBeenCalledTimes(2);
        expect(notificationRepoMocks.create).toHaveBeenCalledWith("friend-1", "user-1", "show_started", 42, undefined);
        expect(notificationRepoMocks.create).toHaveBeenCalledWith("friend-2", "user-1", "show_started", 42, undefined);
    });

    it("passes metadata through for friend-scoped events", async () => {
        friendRepoMocks.getFriends.mockResolvedValue([{ id: "friend-1" }]);

        eventBus.emit("episode.watched", {
            actorUserId: "user-1", showId: 42, metadata: { seasonNumber: 1, episodeCode: "S01E01" },
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "friend-1", "user-1", "episode_watched", 42, { seasonNumber: 1, episodeCode: "S01E01" }
        );
    });

    it("does not fan out when the actor has no friends", async () => {
        friendRepoMocks.getFriends.mockResolvedValue([]);

        eventBus.emit("show.started", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(notificationRepoMocks.create).not.toHaveBeenCalled();
    });

    it("notifies a single recipient directly for one-to-one events, without looking up friends", async () => {
        eventBus.emit("friend.request", { recipientUserId: "user-2", actorUserId: "user-1" });
        await flush();

        expect(friendRepoMocks.getFriends).not.toHaveBeenCalled();
        expect(notificationRepoMocks.create).toHaveBeenCalledWith("user-2", "user-1", "friend_request", undefined, undefined);
    });

    it("a listener failure is isolated and does not throw back into the emitter", async () => {
        friendRepoMocks.getFriends.mockRejectedValue(new Error("db down"));

        expect(() => eventBus.emit("show.started", { actorUserId: "user-1", showId: 42 })).not.toThrow();
        await flush();
    });
});
