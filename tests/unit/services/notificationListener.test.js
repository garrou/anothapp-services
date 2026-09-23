import { describe, it, expect, vi, beforeEach } from "vitest";
import eventBus from "../../../helpers/eventBus.js";
import NotificationListener from "../../../services/notificationListener.js";

const notificationRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    getFriends: vi.fn(),
}));

vi.mock("../../../repositories/notificationRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return notificationRepoMocks; }),
}));
vi.mock("../../../repositories/friendRepository.js", () => ({
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

    it("skips friends listed in excludeUserIds for a friend-scoped event", async () => {
        friendRepoMocks.getFriends.mockResolvedValue([{ id: "friend-1" }, { id: "friend-2" }]);

        eventBus.emit("episode.watched", {
            actorUserId: "user-1", showId: 42, metadata: { seasonNumber: 1 }, excludeUserIds: ["friend-1"],
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledTimes(1);
        expect(notificationRepoMocks.create).toHaveBeenCalledWith("friend-2", "user-1", "episode_watched", 42, { seasonNumber: 1 });
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

    it("fans out a league unlock to every accepted friend", async () => {
        friendRepoMocks.getFriends.mockResolvedValue([{ id: "friend-1" }]);

        eventBus.emit("achievement.league_unlocked", {
            actorUserId: "user-1",
            metadata: { code: "streak", name: "Série de visionnage", league: 2, subTier: 3 },
        });
        await flush();

        expect(friendRepoMocks.getFriends).toHaveBeenCalledWith("user-1");
        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "friend-1", "user-1", "achievement_league_unlocked", undefined,
            { code: "streak", name: "Série de visionnage", league: 2, subTier: 3 }
        );
    });

    it("notifies the invitee for a playlist collaborator invite, with the playlist metadata", async () => {
        eventBus.emit("playlist.collaborator_invited", {
            recipientUserId: "user-2", actorUserId: "user-1",
            metadata: {playlistId: "p1", playlistName: "Mes séries"},
        });
        await flush();

        expect(friendRepoMocks.getFriends).not.toHaveBeenCalled();
        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-2", "user-1", "playlist_collaborator_invited", undefined,
            {playlistId: "p1", playlistName: "Mes séries"}
        );
    });

    it("notifies the owner when a collaborator invite is accepted", async () => {
        eventBus.emit("playlist.collaborator_accepted", {
            recipientUserId: "user-1", actorUserId: "user-2",
            metadata: {playlistId: "p1", playlistName: "Mes séries"},
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", "user-2", "playlist_collaborator_accepted", undefined,
            {playlistId: "p1", playlistName: "Mes séries"}
        );
    });

    it("notifies the owner when a pending collaborator invite is declined", async () => {
        eventBus.emit("playlist.collaborator_declined", {
            recipientUserId: "user-1", actorUserId: "user-2",
            metadata: {playlistId: "p1", playlistName: "Mes séries"},
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", "user-2", "playlist_collaborator_declined", undefined,
            {playlistId: "p1", playlistName: "Mes séries"}
        );
    });

    it("notifies the owner when a collaborator adds a show to the playlist", async () => {
        eventBus.emit("playlist.show_added", {
            recipientUserId: "user-1", actorUserId: "user-2",
            metadata: {playlistId: "p1", playlistName: "Mes séries", showId: 42, showTitle: "Breaking Bad"},
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", "user-2", "playlist_show_added", undefined,
            {playlistId: "p1", playlistName: "Mes séries", showId: 42, showTitle: "Breaking Bad"}
        );
    });

    it("notifies the owner when a collaborator removes a show from the playlist", async () => {
        eventBus.emit("playlist.show_removed", {
            recipientUserId: "user-1", actorUserId: "user-2",
            metadata: {playlistId: "p1", playlistName: "Mes séries", showId: 42, showTitle: "Breaking Bad"},
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", "user-2", "playlist_show_removed", undefined,
            {playlistId: "p1", playlistName: "Mes séries", showId: 42, showTitle: "Breaking Bad"}
        );
    });

    it("notifies the owner when their watch-together invite is accepted, with the show id", async () => {
        eventBus.emit("season.watched_with.accepted", {
            recipientUserId: "user-1", actorUserId: "user-2", showId: 42, metadata: {seasonNumber: 1},
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", "user-2", "season_watched_with_accepted", 42, {seasonNumber: 1}
        );
    });

    it("notifies the owner when their watch-together invite is declined, with the show id", async () => {
        eventBus.emit("season.watched_with.declined", {
            recipientUserId: "user-1", actorUserId: "user-2", showId: 42, metadata: {seasonNumber: 1},
        });
        await flush();

        expect(notificationRepoMocks.create).toHaveBeenCalledWith(
            "user-1", "user-2", "season_watched_with_declined", 42, {seasonNumber: 1}
        );
    });

    it("a listener failure is isolated and does not throw back into the emitter", async () => {
        friendRepoMocks.getFriends.mockRejectedValue(new Error("db down"));

        expect(() => eventBus.emit("show.started", { actorUserId: "user-1", showId: 42 })).not.toThrow();
        await flush();
    });
});
