import { describe, it, expect, vi, beforeEach } from "vitest";
import EpisodeService from "../../../services/episodeService.js";

const episodeRepoMocks = vi.hoisted(() => ({
    getEpisodesByShowIdBySeason: vi.fn(),
    getEpisodeById: vi.fn(),
    upsertEpisode: vi.fn(),
}));
const userEpisodeRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    createIfMissing: vi.fn(),
    existsForViewing: vi.fn(),
    updateWatchedAt: vi.fn(),
    updatePlatformByUserSeasonId: vi.fn(),
    deleteById: vi.fn(),
    getByUserSeasonId: vi.fn(),
    getViewedByMonthAgo: vi.fn(),
    getWatchedTimeByShowIdBySeasonNumber: vi.fn(),
    getWatchedTimeAndCountByShowId: vi.fn(),
    getWatchedForUserSeasonId: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getOwnedSeasonViewing: vi.fn(),
}));
const watchTogetherRepoMocks = vi.hoisted(() => ({
    getLinkedViewings: vi.fn(),
}));
const searchServiceMocks = vi.hoisted(() => ({
    getEpisodesByShowIdBySeason: vi.fn(),
}));
const eventBusMocks = vi.hoisted(() => ({
    emit: vi.fn(),
}));

vi.mock("../../../helpers/eventBus.js", () => ({
    default: eventBusMocks,
}));
vi.mock("../../../repositories/episodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeRepoMocks; }),
}));
vi.mock("../../../repositories/userEpisodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeRepoMocks; }),
}));
vi.mock("../../../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../../../repositories/watchTogetherRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return watchTogetherRepoMocks; }),
}));
vi.mock("../../../services/searchService.js", () => ({
    default: vi.fn().mockImplementation(function () { return searchServiceMocks; }),
}));

describe("EpisodeService.getViewedByMonthAgo", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when month isn't one of the accepted values", async () => {
        await expect(episodeService.getViewedByMonthAgo("user-1", "not-a-month")).rejects.toThrow(
            "Requête invalide"
        );
        expect(userEpisodeRepoMocks.getViewedByMonthAgo).not.toHaveBeenCalled();
    });

    it("accepts every documented month shortcut value", async () => {
        userEpisodeRepoMocks.getViewedByMonthAgo.mockResolvedValue([]);

        for (const month of ["0", "1", "2", "3", "6", "12"]) {
            await expect(episodeService.getViewedByMonthAgo("user-1", month)).resolves.toEqual([]);
        }
    });

    it("returns the timeline for a valid month", async () => {
        userEpisodeRepoMocks.getViewedByMonthAgo.mockResolvedValue(["episode-timeline"]);

        const result = await episodeService.getViewedByMonthAgo("user-1", "1");

        expect(result).toEqual(["episode-timeline"]);
        expect(userEpisodeRepoMocks.getViewedByMonthAgo).toHaveBeenCalledWith("user-1", "1");
    });
});

describe("EpisodeService.getWatchedTimeByShowIdBySeasonNumber", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when showId or seasonNumber is missing", async () => {
        await expect(episodeService.getWatchedTimeByShowIdBySeasonNumber("user-1", undefined, 1)).rejects.toThrow(
            "Requête invalide"
        );
        await expect(episodeService.getWatchedTimeByShowIdBySeasonNumber("user-1", 42, undefined)).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("returns the total watched time", async () => {
        userEpisodeRepoMocks.getWatchedTimeByShowIdBySeasonNumber.mockResolvedValue(135);

        const result = await episodeService.getWatchedTimeByShowIdBySeasonNumber("user-1", 42, 1);

        expect(result).toBe(135);
        expect(userEpisodeRepoMocks.getWatchedTimeByShowIdBySeasonNumber).toHaveBeenCalledWith("user-1", 42, 1);
    });
});

describe("EpisodeService.getWatchedTimeAndCountByShowId", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when showId is missing", async () => {
        await expect(episodeService.getWatchedTimeAndCountByShowId("user-1", undefined)).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("returns the total watched time, episode count and distinct episode count", async () => {
        userEpisodeRepoMocks.getWatchedTimeAndCountByShowId.mockResolvedValue([135, 3, 2]);

        const result = await episodeService.getWatchedTimeAndCountByShowId("user-1", 42);

        expect(result).toEqual([135, 3, 2]);
        expect(userEpisodeRepoMocks.getWatchedTimeAndCountByShowId).toHaveBeenCalledWith("user-1", 42);
    });
});

describe("EpisodeService.getByUserSeasonId", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when no userSeasonId is given", async () => {
        await expect(episodeService.getByUserSeasonId("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the viewing isn't owned by the user", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue(null);

        await expect(episodeService.getByUserSeasonId("user-1", 7)).rejects.toThrow(
            "Ce visionnage n'est pas dans votre collection"
        );
    });

    it("returns the checklist for an owned viewing", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue({ showId: 42, number: 1 });
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1 }]);
        userEpisodeRepoMocks.getByUserSeasonId.mockResolvedValue(["episode-checklist"]);

        const result = await episodeService.getByUserSeasonId("user-1", 7);

        expect(result).toEqual(["episode-checklist"]);
        expect(userEpisodeRepoMocks.getByUserSeasonId).toHaveBeenCalledWith(7, 42, 1);
    });

    it("syncs episodes from BetaSeries first when the season was just added and none exist locally yet", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue({ showId: 42, number: 1 });
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([]);
        searchServiceMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1, title: "Pilot", code: "S01E01", global: 1, number: 1, length: 45, date: "2020-01-01" },
        ]);
        userEpisodeRepoMocks.getByUserSeasonId.mockResolvedValue(["episode-checklist"]);

        const result = await episodeService.getByUserSeasonId("user-1", 7);

        expect(episodeRepoMocks.upsertEpisode).toHaveBeenCalledWith(
            1, 42, 1, 1, "Pilot", "S01E01", 1, 45, "2020-01-01"
        );
        expect(result).toEqual(["episode-checklist"]);
    });
});

describe("EpisodeService.addViewing", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue({ showId: 42, number: 1, platformId: 999 });
        userEpisodeRepoMocks.existsForViewing.mockResolvedValue(false);
        userEpisodeRepoMocks.create.mockResolvedValue(true);
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([]);
    });

    it("rejects with a 400 when userSeasonId or episodeId is missing", async () => {
        await expect(episodeService.addViewing("user-1", undefined, 1)).rejects.toThrow("Requête invalide");
        await expect(episodeService.addViewing("user-1", 7, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the viewing isn't owned by the user", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue(null);

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Ce visionnage n'est pas dans votre collection"
        );
    });

    it("rejects with a 400 when the episode doesn't belong to that viewing's season", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 2, date: past });

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Cet épisode ne fait pas partie de cette saison"
        );
    });

    it("rejects with a 400 when the episode has no air date yet", async () => {
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: null });

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Cet épisode n'est pas encore diffusé"
        );
    });

    it("rejects with a 409 when the episode is already recorded for this viewing", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });
        userEpisodeRepoMocks.existsForViewing.mockResolvedValue(true);

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Cet épisode a déjà été visionné pour ce visionnage"
        );
        expect(userEpisodeRepoMocks.create).not.toHaveBeenCalled();
    });

    it("creates the viewing when everything checks out and notifies friends", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({
            id: 1, showId: 42, seasonNumber: 1, date: past, code: "S01E01", title: "Pilot",
        });

        await expect(episodeService.addViewing("user-1", 7, 1)).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.create).toHaveBeenCalledWith("user-1", 7, 1, expect.any(String), 999);
        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.watched", {
            actorUserId: "user-1", showId: 42,
            metadata: {seasonNumber: 1, episodeCode: "S01E01", episodeTitle: "Pilot"},
        });
    });

    it("rejects with a 409 when create() loses a race against a concurrent watch-together mirror, rather than a 500", async () => {
        // existsForViewing found nothing, but a mirrored write from a linked viewing can still land
        // first on the exact same (userSeasonId, episodeId) row before this create() runs - create()
        // then reports it via ON CONFLICT DO NOTHING (rowCount 0) instead of throwing
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });
        userEpisodeRepoMocks.create.mockResolvedValue(false);

        await expect(episodeService.addViewing("user-1", 7, 1)).rejects.toThrow(
            "Cet épisode a déjà été visionné pour ce visionnage"
        );
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
        expect(watchTogetherRepoMocks.getLinkedViewings).not.toHaveBeenCalled();
    });

    it("mirrors the episode into every watch-together linked viewing", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([
            { id: 8, userId: "friend-1" }, { id: 9, userId: "friend-2" },
        ]);

        await episodeService.addViewing("user-1", 7, 1);

        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-1", 8, 1, expect.any(String), 999);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-2", 9, 1, expect.any(String), 999);
    });

    it("does not fan out when there is no watch-together link", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });

        await episodeService.addViewing("user-1", 7, 1);

        expect(userEpisodeRepoMocks.createIfMissing).not.toHaveBeenCalled();
    });

    it("notifies each mirrored viewer's own friends, excluding the rest of the watch-together group", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({
            id: 1, showId: 42, seasonNumber: 1, date: past, code: "S01E01", title: "Pilot",
        });
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([
            { id: 8, userId: "friend-1" }, { id: 9, userId: "friend-2" },
        ]);
        userEpisodeRepoMocks.createIfMissing.mockResolvedValue(true);

        await episodeService.addViewing("user-1", 7, 1);

        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.watched", {
            actorUserId: "friend-1", showId: 42,
            metadata: {seasonNumber: 1, episodeCode: "S01E01", episodeTitle: "Pilot"},
            excludeUserIds: ["user-1", "friend-2"],
        });
        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.watched", {
            actorUserId: "friend-2", showId: 42,
            metadata: {seasonNumber: 1, episodeCode: "S01E01", episodeTitle: "Pilot"},
            excludeUserIds: ["user-1", "friend-1"],
        });
    });

    it("does not notify on behalf of a mirrored viewer who already had the episode", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1, showId: 42, seasonNumber: 1, date: past });
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{ id: 8, userId: "friend-1" }]);
        userEpisodeRepoMocks.createIfMissing.mockResolvedValue(false);

        await episodeService.addViewing("user-1", 7, 1);

        expect(eventBusMocks.emit).toHaveBeenCalledTimes(1); // only the actor's own episode.watched
        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.watched", expect.objectContaining({ actorUserId: "user-1" }));
    });
});

describe("EpisodeService.addAllViewings", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue({ showId: 42, number: 1, platformId: 999 });
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([]);
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([]);
    });

    it("rejects with a 400 when no userSeasonId is given", async () => {
        await expect(episodeService.addAllViewings("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the viewing isn't owned by the user", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue(null);

        await expect(episodeService.addAllViewings("user-1", 7)).rejects.toThrow(
            "Ce visionnage n'est pas dans votre collection"
        );
    });

    it("creates a viewing for every already-aired episode of the season, skipping unaired ones, and notifies friends once", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        const future = new Date(Date.now() + 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1, date: past },
            { id: 2, date: future },
            { id: 3, date: null },
        ]);
        userEpisodeRepoMocks.createIfMissing.mockResolvedValue(true);

        await expect(episodeService.addAllViewings("user-1", 7)).resolves.toBeUndefined();

        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledTimes(1);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("user-1", 7, 1, expect.any(String), 999);
        expect(eventBusMocks.emit).toHaveBeenCalledTimes(1);
        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.bulk_watched", {
            actorUserId: "user-1", showId: 42, metadata: {seasonNumber: 1, count: 1},
        });
    });

    it("stays silent when every episode was already marked watched (createIfMissing no-ops)", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1, date: past }]);
        userEpisodeRepoMocks.createIfMissing.mockResolvedValue(false);

        await episodeService.addAllViewings("user-1", 7);

        expect(eventBusMocks.emit).not.toHaveBeenCalled();
        expect(watchTogetherRepoMocks.getLinkedViewings).not.toHaveBeenCalled();
    });

    it("mirrors only the newly-watched episodes into linked viewings", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1, date: past }, { id: 2, date: past }]);
        userEpisodeRepoMocks.createIfMissing
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
            .mockResolvedValue(true);
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{ id: 8, userId: "friend-1" }]);

        await episodeService.addAllViewings("user-1", 7);

        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-1", 8, 1, expect.any(String), 999);
        expect(userEpisodeRepoMocks.createIfMissing).not.toHaveBeenCalledWith("friend-1", 8, 2, expect.any(String), 999);
    });

    it("fetches the linked viewings only once for the whole batch, not once per newly-watched episode", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1, date: past }, { id: 2, date: past }, { id: 3, date: past },
        ]);
        userEpisodeRepoMocks.createIfMissing.mockResolvedValue(true);
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{ id: 8, userId: "friend-1" }]);

        await episodeService.addAllViewings("user-1", 7);

        expect(watchTogetherRepoMocks.getLinkedViewings).toHaveBeenCalledTimes(1);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-1", 8, 1, expect.any(String), 999);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-1", 8, 2, expect.any(String), 999);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-1", 8, 3, expect.any(String), 999);
    });

    it("notifies a mirrored viewer's own friends with their own count, excluding the group", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1, date: past }, { id: 2, date: past }]);
        userEpisodeRepoMocks.createIfMissing.mockResolvedValue(true);
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{ id: 8, userId: "friend-1" }]);

        await episodeService.addAllViewings("user-1", 7);

        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.bulk_watched", {
            actorUserId: "friend-1", showId: 42,
            metadata: {seasonNumber: 1, count: 2},
            excludeUserIds: ["user-1"],
        });
    });

    it("counts only friend-1's own newly-created rows, not the actor's, when mirroring is partial", async () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        episodeRepoMocks.getEpisodesByShowIdBySeason.mockResolvedValue([{ id: 1, date: past }, { id: 2, date: past }]);
        // both newly-watched for the actor; friend-1 already had episode 1 from an earlier backfill
        userEpisodeRepoMocks.createIfMissing
            .mockResolvedValueOnce(true).mockResolvedValueOnce(true) // actor: ep1, ep2
            .mockResolvedValueOnce(false).mockResolvedValueOnce(true); // friend-1: ep1 (skip), ep2 (new)
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{ id: 8, userId: "friend-1" }]);

        await episodeService.addAllViewings("user-1", 7);

        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.bulk_watched", {
            actorUserId: "friend-1", showId: 42,
            metadata: {seasonNumber: 1, count: 1},
            excludeUserIds: ["user-1"],
        });
    });
});

describe("EpisodeService.backfillLinkedViewings", () => {
    let episodeService;
    const client = {};

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([]);
    });

    it("copies each side's already-watched episodes into the other's viewing, for a simple pair", async () => {
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{id: 55, userId: "friend-1"}]);
        userEpisodeRepoMocks.getWatchedForUserSeasonId
            .mockResolvedValueOnce([{episodeId: 1, watchedAt: "2024-01-01", platformId: 999}])
            .mockResolvedValueOnce([{episodeId: 2, watchedAt: "2024-01-02", platformId: 1}]);

        const result = await episodeService.backfillLinkedViewings(7, "owner-1", client);

        expect(watchTogetherRepoMocks.getLinkedViewings).toHaveBeenCalledWith(7, client);
        expect(userEpisodeRepoMocks.getWatchedForUserSeasonId).toHaveBeenCalledWith(7, client);
        expect(userEpisodeRepoMocks.getWatchedForUserSeasonId).toHaveBeenCalledWith(55, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-1", 55, 1, "2024-01-01", 999, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("owner-1", 7, 2, "2024-01-02", 1, client);
        expect(result.sort()).toEqual(["friend-1", "owner-1"].sort());
    });

    it("does nothing when no member has watched anything yet", async () => {
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{id: 55, userId: "friend-1"}]);
        userEpisodeRepoMocks.getWatchedForUserSeasonId.mockResolvedValue([]);

        const result = await episodeService.backfillLinkedViewings(7, "owner-1", client);

        expect(userEpisodeRepoMocks.createIfMissing).not.toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it("returns only the members who actually received a backfilled episode", async () => {
        // root already has everything the group has ever watched - only the friend is missing E1
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([{id: 55, userId: "friend-1"}]);
        userEpisodeRepoMocks.getWatchedForUserSeasonId.mockImplementation(async (userSeasonId) => (
            userSeasonId === 7 ? [{episodeId: 1, watchedAt: "2024-01-01", platformId: 999}] : []
        ));

        const result = await episodeService.backfillLinkedViewings(7, "owner-1", client);

        expect(result).toEqual(["friend-1"]);
    });

    it("merges the union of every member's history across a group of more than two, not just root/newcomer", async () => {
        // root already watched E1, an existing friend already watched E2, the one just joining
        // already watched E3 - every member should end up missing only the episodes it doesn't have
        watchTogetherRepoMocks.getLinkedViewings.mockResolvedValue([
            {id: 55, userId: "friend-A"}, {id: 77, userId: "friend-B"},
        ]);
        userEpisodeRepoMocks.getWatchedForUserSeasonId.mockImplementation(async (userSeasonId) => {
            if (userSeasonId === 7) return [{episodeId: 1, watchedAt: "2024-01-01", platformId: 999}];
            if (userSeasonId === 55) return [{episodeId: 2, watchedAt: "2024-01-02", platformId: 999}];
            if (userSeasonId === 77) return [{episodeId: 3, watchedAt: "2024-01-03", platformId: 999}];
            return [];
        });

        const result = await episodeService.backfillLinkedViewings(7, "owner-1", client);

        // root (7) gets E2 and E3, friend-A (55) gets E1 and E3, friend-B (77) gets E1 and E2
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("owner-1", 7, 2, "2024-01-02", 999, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("owner-1", 7, 3, "2024-01-03", 999, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-A", 55, 1, "2024-01-01", 999, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-A", 55, 3, "2024-01-03", 999, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-B", 77, 1, "2024-01-01", 999, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledWith("friend-B", 77, 2, "2024-01-02", 999, client);
        expect(userEpisodeRepoMocks.createIfMissing).toHaveBeenCalledTimes(6);
        expect(result.sort()).toEqual(["friend-A", "friend-B", "owner-1"].sort());
    });
});

describe("EpisodeService.updateViewing", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when id or watchedAt is missing", async () => {
        await expect(episodeService.updateViewing("user-1", undefined, "2024-01-01")).rejects.toThrow(
            "Requête invalide"
        );
        await expect(episodeService.updateViewing("user-1", 5, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the date is in the future", async () => {
        const future = new Date(Date.now() + 86400000).toISOString();

        await expect(episodeService.updateViewing("user-1", 5, future)).rejects.toThrow(
            "Date de visionnage invalide"
        );
    });

    it("updates the viewing when valid", async () => {
        userEpisodeRepoMocks.updateWatchedAt.mockResolvedValue(true);

        await expect(episodeService.updateViewing("user-1", 5, "2024-01-01")).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.updateWatchedAt).toHaveBeenCalledWith("user-1", 5, "2024-01-01");
    });

    it("throws a 500 when nothing was updated", async () => {
        userEpisodeRepoMocks.updateWatchedAt.mockResolvedValue(false);

        await expect(episodeService.updateViewing("user-1", 5, "2024-01-01")).rejects.toThrow(
            "Impossible de modifier le visionnage"
        );
    });
});

describe("EpisodeService.updatePlatformForSeason", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("cascades the platform onto the season's episodes", async () => {
        await episodeService.updatePlatformForSeason("user-1", 7, 999);

        expect(userEpisodeRepoMocks.updatePlatformByUserSeasonId).toHaveBeenCalledWith(7, 999);
    });
});

describe("EpisodeService.deleteViewing", () => {
    let episodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        episodeService = new EpisodeService();
    });

    it("rejects with a 400 when no id is given", async () => {
        await expect(episodeService.deleteViewing("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("deletes the viewing when it exists", async () => {
        userEpisodeRepoMocks.deleteById.mockResolvedValue(true);

        await expect(episodeService.deleteViewing("user-1", 5)).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.deleteById).toHaveBeenCalledWith("user-1", 5);
    });

    it("throws a 500 when nothing was deleted", async () => {
        userEpisodeRepoMocks.deleteById.mockResolvedValue(false);

        await expect(episodeService.deleteViewing("user-1", 5)).rejects.toThrow(
            "Impossible de supprimer le visionnage"
        );
    });
});
