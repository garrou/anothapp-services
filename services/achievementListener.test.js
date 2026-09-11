import { describe, it, expect, vi, beforeEach } from "vitest";
import eventBus from "../helpers/eventBus.js";
import AchievementListener from "./achievementListener.js";

const achievementServiceMocks = vi.hoisted(() => ({
    evaluate: vi.fn(),
}));

vi.mock("./achievementService.js", () => ({
    default: vi.fn().mockImplementation(function () { return achievementServiceMocks; }),
}));

// eventBus.emit() fires listeners as detached microtasks (see helpers/eventBus.js)
// so a listener's async work needs a tick to run before we can assert on it.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("AchievementListener", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.removeAllListeners();
        new AchievementListener();
    });

    it("evaluates only the codes a single episode watched can affect", async () => {
        eventBus.emit("episode.watched", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith(
            "user-1", ["streak", "watch_time", "shows_completed"]
        );
    });

    it("evaluates the same narrowed codes for a bulk episode watch", async () => {
        eventBus.emit("episode.bulk_watched", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith(
            "user-1", ["streak", "watch_time", "shows_completed"]
        );
    });

    it("evaluates the broader season-level codes for a season watched", async () => {
        eventBus.emit("season.watched", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith(
            "user-1",
            ["streak", "watch_time", "shows_started", "shows_completed", "countries", "kinds", "platforms"]
        );
    });

    it("evaluates only shows_started/countries/kinds for a show started", async () => {
        eventBus.emit("show.started", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1", ["shows_started", "countries", "kinds"]);
    });

    it("evaluates only notes_count for a show rated", async () => {
        eventBus.emit("show.rated", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1", ["notes_count"]);
    });

    it("evaluates only friends_count for both sides of an accepted friend request", async () => {
        eventBus.emit("friend.accepted", { recipientUserId: "user-2", actorUserId: "user-1" });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1", ["friends_count"]);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-2", ["friends_count"]);
    });

    it("evaluates friends_watched_with and duo for the actor and every tagged recipient", async () => {
        eventBus.emit("season.watched_with", {
            actorUserId: "user-1", recipientIds: ["user-2", "user-3"], showId: 42,
        });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledTimes(3);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1", ["friends_watched_with", "duo"]);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-2", ["friends_watched_with", "duo"]);
        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-3", ["friends_watched_with", "duo"]);
    });

    it("evaluates only favorites_count for a show favorited", async () => {
        eventBus.emit("show.favorited", { actorUserId: "user-1", showId: 42 });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1", ["favorites_count"]);
    });

    it("evaluates only playlists_count for a playlist created", async () => {
        eventBus.emit("playlist.created", { actorUserId: "user-1" });
        await flush();

        expect(achievementServiceMocks.evaluate).toHaveBeenCalledWith("user-1", ["playlists_count"]);
    });

    it("never includes account_age in any event's code list - it has its own scheduled task", async () => {
        for (const [event, payload] of [
            ["season.watched", { actorUserId: "u", showId: 1 }],
            ["episode.watched", { actorUserId: "u", showId: 1 }],
            ["show.started", { actorUserId: "u", showId: 1 }],
            ["show.rated", { actorUserId: "u", showId: 1 }],
            ["friend.accepted", { actorUserId: "u", recipientUserId: "u2" }],
        ]) {
            eventBus.emit(event, payload);
        }
        await flush();

        for (const call of achievementServiceMocks.evaluate.mock.calls) {
            expect(call[1]).not.toContain("account_age");
        }
    });
});
