import { describe, it, expect, vi, beforeEach } from "vitest";
import SeasonService from "../../../services/seasonService.js";

const seasonRepoMocks = vi.hoisted(() => ({
    deleteSeasonById: vi.fn(),
    updateSeason: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    getOwnedSeasonViewing: vi.fn(),
    getSeasonViewingById: vi.fn(),
}));
const userSeasonFriendRepoMocks = vi.hoisted(() => ({
    setForUserSeasonId: vi.fn(),
    getStatus: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    getPendingForUser: vi.fn(),
}));
const watchTogetherRepoMocks = vi.hoisted(() => ({
    lockSeasons: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    hasConflictingLink: vi.fn(),
    getActiveForUser: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
    transaction: vi.fn(),
}));
const fakeClient = vi.hoisted(() => ({}));
const friendRepoMocks = vi.hoisted(() => ({
    getFriends: vi.fn(),
    checkIfAlreadyFriend: vi.fn(),
}));
const eventBusMocks = vi.hoisted(() => ({
    emit: vi.fn(),
}));
const episodeServiceMocks = vi.hoisted(() => ({
    getByUserSeasonId: vi.fn(),
    addViewing: vi.fn(),
    updatePlatformForSeason: vi.fn(),
    backfillLinkedViewings: vi.fn(),
}));
const showServiceMocks = vi.hoisted(() => ({
    ensureSeasonTracked: vi.fn(),
}));

vi.mock("../../../config/db.js", () => ({
    default: dbMocks,
}));
vi.mock("../../../repositories/seasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return seasonRepoMocks; }),
}));
vi.mock("../../../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../../../repositories/userSeasonFriendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonFriendRepoMocks; }),
}));
vi.mock("../../../repositories/watchTogetherRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return watchTogetherRepoMocks; }),
}));
vi.mock("../../../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));
vi.mock("../../../helpers/eventBus.js", () => ({
    default: eventBusMocks,
}));
vi.mock("../../../services/episodeService.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeServiceMocks; }),
}));
vi.mock("../../../services/showService.js", () => ({
    default: vi.fn().mockImplementation(function () { return showServiceMocks; }),
}));

// db.transaction just runs the callback against a shared fake client - clearAllMocks() (used by
// every describe block below) clears call history but keeps this implementation in place.
dbMocks.transaction.mockImplementation((callback) => callback(fakeClient));

describe("SeasonService.deleteBySeasonId", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("rejects with a 400 when no seasonId is given", async () => {
        await expect(seasonService.deleteBySeasonId("user-1", undefined)).rejects.toThrow(
            "Requête invalide"
        );
        expect(seasonRepoMocks.deleteSeasonById).not.toHaveBeenCalled();
    });

    it("deletes the season when it exists", async () => {
        seasonRepoMocks.deleteSeasonById.mockResolvedValue(true);

        await expect(seasonService.deleteBySeasonId("user-1", 7)).resolves.toBeUndefined();
        expect(seasonRepoMocks.deleteSeasonById).toHaveBeenCalledWith("user-1", 7);
    });

    it("throws a 500 when nothing was deleted", async () => {
        seasonRepoMocks.deleteSeasonById.mockResolvedValue(false);

        await expect(seasonService.deleteBySeasonId("user-1", 7)).rejects.toThrow(
            "Impossible de supprimer la saison"
        );
    });
});

describe("SeasonService.getEpisodesBySeasonId", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("delegates to EpisodeService.getByUserSeasonId", async () => {
        episodeServiceMocks.getByUserSeasonId.mockResolvedValue(["episode-checklist"]);

        const result = await seasonService.getEpisodesBySeasonId("user-1", 7);

        expect(result).toEqual(["episode-checklist"]);
        expect(episodeServiceMocks.getByUserSeasonId).toHaveBeenCalledWith("user-1", 7);
    });
});

describe("SeasonService.addEpisodeViewing", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("delegates to EpisodeService.addViewing", async () => {
        await seasonService.addEpisodeViewing("user-1", 7, 100);

        expect(episodeServiceMocks.addViewing).toHaveBeenCalledWith("user-1", 7, 100);
    });
});

describe("SeasonService.updateBySeasonId", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("rejects with a 400 when seasonId is missing", async () => {
        await expect(
            seasonService.updateBySeasonId("user-1", undefined, 2, "2024-01-01")
        ).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when platformId is missing", async () => {
        await expect(
            seasonService.updateBySeasonId("user-1", 7, undefined, "2024-01-01")
        ).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when viewedAt is missing", async () => {
        await expect(
            seasonService.updateBySeasonId("user-1", 7, 2, undefined)
        ).rejects.toThrow("Requête invalide");
    });

    it("updates the season and cascades the platform onto its episodes", async () => {
        seasonRepoMocks.updateSeason.mockResolvedValue(true);

        await expect(
            seasonService.updateBySeasonId("user-1", 7, 2, "2024-01-01")
        ).resolves.toBeUndefined();
        expect(seasonRepoMocks.updateSeason).toHaveBeenCalledWith("user-1", 7, 2, "2024-01-01");
        expect(episodeServiceMocks.updatePlatformForSeason).toHaveBeenCalledWith("user-1", 7, 2);
    });

    it("throws a 500 when the update fails in the database", async () => {
        seasonRepoMocks.updateSeason.mockResolvedValue(false);

        await expect(
            seasonService.updateBySeasonId("user-1", 7, 2, "2024-01-01")
        ).rejects.toThrow("Impossible de modifier la saison");
        expect(episodeServiceMocks.updatePlatformForSeason).not.toHaveBeenCalled();
    });
});

describe("SeasonService.updateWatchedWith", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue({showId: 42, number: 1, platformId: 999});
        friendRepoMocks.getFriends.mockResolvedValue([{id: "friend-1"}, {id: "friend-2"}]);
    });

    it("rejects with a 400 when seasonId is missing", async () => {
        await expect(seasonService.updateWatchedWith("user-1", undefined, [])).rejects.toThrow(
            "Requête invalide"
        );
        expect(userSeasonFriendRepoMocks.setForUserSeasonId).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when friendIds isn't an array", async () => {
        await expect(seasonService.updateWatchedWith("user-1", 7, "friend-1")).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("rejects with a 400 when more than 10 friends are tagged", async () => {
        const tooMany = Array.from({length: 11}, (_, i) => `friend-${i}`);

        await expect(seasonService.updateWatchedWith("user-1", 7, tooMany)).rejects.toThrow(
            "Vous ne pouvez pas taguer plus de 10 amis"
        );
        expect(userSeasonRepoMocks.getOwnedSeasonViewing).not.toHaveBeenCalled();
    });

    it("rejects with a 404 when the viewing isn't owned by the current user", async () => {
        userSeasonRepoMocks.getOwnedSeasonViewing.mockResolvedValue(null);

        await expect(seasonService.updateWatchedWith("user-1", 7, ["friend-1"])).rejects.toThrow(
            "Visionnage introuvable"
        );
        expect(userSeasonFriendRepoMocks.setForUserSeasonId).not.toHaveBeenCalled();
    });

    it("rejects with a 400 when a tagged user isn't an accepted friend", async () => {
        await expect(seasonService.updateWatchedWith("user-1", 7, ["friend-1", "stranger"])).rejects.toThrow(
            "Vous ne pouvez taguer que des amis"
        );
        expect(userSeasonFriendRepoMocks.setForUserSeasonId).not.toHaveBeenCalled();
    });

    it("dedupes friend ids, persists them and notifies only the newly invited ones", async () => {
        userSeasonFriendRepoMocks.setForUserSeasonId.mockResolvedValue({invited: ["friend-1", "friend-2"], revoked: []});

        await seasonService.updateWatchedWith("user-1", 7, ["friend-1", "friend-1", "friend-2"]);

        expect(userSeasonFriendRepoMocks.setForUserSeasonId).toHaveBeenCalledWith(7, ["friend-1", "friend-2"], fakeClient);
        expect(eventBusMocks.emit).toHaveBeenCalledWith("season.watched_with", {
            actorUserId: "user-1",
            recipientIds: ["friend-1", "friend-2"],
            showId: 42,
            metadata: {seasonNumber: 1}
        });
    });

    it("does not notify a friend who was already tagged and unaffected by the update", async () => {
        userSeasonFriendRepoMocks.setForUserSeasonId.mockResolvedValue({invited: [], revoked: []});

        await seasonService.updateWatchedWith("user-1", 7, ["friend-1", "friend-2"]);

        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("clears the tags without checking friendship or notifying when friendIds is empty", async () => {
        userSeasonFriendRepoMocks.setForUserSeasonId.mockResolvedValue({invited: [], revoked: []});

        await seasonService.updateWatchedWith("user-1", 7, []);

        expect(friendRepoMocks.getFriends).not.toHaveBeenCalled();
        expect(userSeasonFriendRepoMocks.setForUserSeasonId).toHaveBeenCalledWith(7, [], fakeClient);
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("ends the live relation for a friend dropped from the list while their invite was accepted, in the same transaction as the tag update", async () => {
        userSeasonFriendRepoMocks.setForUserSeasonId.mockResolvedValue({invited: [], revoked: ["friend-1"]});

        await seasonService.updateWatchedWith("user-1", 7, []);

        expect(watchTogetherRepoMocks.remove).toHaveBeenCalledWith(7, "friend-1", fakeClient);
    });
});

describe("SeasonService.getWatchedWith", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
    });

    it("delegates to getPendingForUser for status=pending", async () => {
        userSeasonFriendRepoMocks.getPendingForUser.mockResolvedValue(["invite-1"]);

        const result = await seasonService.getWatchedWith("user-1", "pending");

        expect(result).toEqual(["invite-1"]);
        expect(userSeasonFriendRepoMocks.getPendingForUser).toHaveBeenCalledWith("user-1");
    });

    it("delegates to getActiveForUser for status=active", async () => {
        watchTogetherRepoMocks.getActiveForUser.mockResolvedValue(["active-1"]);

        const result = await seasonService.getWatchedWith("user-1", "active");

        expect(result).toEqual(["active-1"]);
        expect(watchTogetherRepoMocks.getActiveForUser).toHaveBeenCalledWith("user-1");
    });

    it("rejects with a 400 for a missing or unknown status", async () => {
        await expect(seasonService.getWatchedWith("user-1", undefined)).rejects.toThrow("Requête invalide");
        await expect(seasonService.getWatchedWith("user-1", "unknown")).rejects.toThrow("Requête invalide");
        expect(userSeasonFriendRepoMocks.getPendingForUser).not.toHaveBeenCalled();
        expect(watchTogetherRepoMocks.getActiveForUser).not.toHaveBeenCalled();
    });
});

describe("SeasonService.respondToWatchedWith", () => {
    let seasonService;

    beforeEach(() => {
        vi.clearAllMocks();
        seasonService = new SeasonService();
        userSeasonRepoMocks.getSeasonViewingById.mockResolvedValue({userId: "owner-1", showId: 42, number: 1, platformId: 999});
        episodeServiceMocks.backfillLinkedViewings.mockResolvedValue([]);
    });

    it("rejects with a 400 when userSeasonId is missing", async () => {
        await expect(seasonService.respondToWatchedWith("friend-1", undefined, true)).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("rejects with a 400 when accepted isn't a boolean", async () => {
        await expect(seasonService.respondToWatchedWith("friend-1", 7, "yes")).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("rejects with a 404 when there is no invitation for this user", async () => {
        userSeasonFriendRepoMocks.getStatus.mockResolvedValue(undefined);

        await expect(seasonService.respondToWatchedWith("friend-1", 7, true)).rejects.toThrow(
            "Invitation introuvable"
        );
        expect(showServiceMocks.ensureSeasonTracked).not.toHaveBeenCalled();
    });

    it("declining marks the link declined, ends any live relation and notifies the owner", async () => {
        userSeasonFriendRepoMocks.getStatus.mockResolvedValue(null);

        await seasonService.respondToWatchedWith("friend-1", 7, false);

        expect(userSeasonFriendRepoMocks.decline).toHaveBeenCalledWith(7, "friend-1", fakeClient);
        expect(watchTogetherRepoMocks.remove).toHaveBeenCalledWith(7, "friend-1", fakeClient);
        expect(showServiceMocks.ensureSeasonTracked).not.toHaveBeenCalled();
        expect(eventBusMocks.emit).toHaveBeenCalledWith("season.watched_with.declined", {
            recipientUserId: "owner-1", actorUserId: "friend-1", showId: 42, metadata: {seasonNumber: 1},
        });
    });

    it("accepting ensures the friend's own viewing, creates the live relation and notifies the owner", async () => {
        userSeasonFriendRepoMocks.getStatus.mockResolvedValue(null);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        showServiceMocks.ensureSeasonTracked.mockResolvedValue(55);
        watchTogetherRepoMocks.hasConflictingLink.mockResolvedValue(false);
        userSeasonFriendRepoMocks.accept.mockResolvedValue(true);
        watchTogetherRepoMocks.create.mockResolvedValue(true);

        await seasonService.respondToWatchedWith("friend-1", 7, true);

        expect(friendRepoMocks.checkIfAlreadyFriend).toHaveBeenCalledWith("owner-1", "friend-1");
        expect(showServiceMocks.ensureSeasonTracked).toHaveBeenCalledWith("friend-1", 42, 1, 999);
        expect(watchTogetherRepoMocks.lockSeasons).toHaveBeenCalledWith(fakeClient, 7, 55);
        expect(watchTogetherRepoMocks.hasConflictingLink).toHaveBeenCalledWith(7, 55, fakeClient);
        expect(userSeasonFriendRepoMocks.accept).toHaveBeenCalledWith(7, "friend-1", fakeClient);
        expect(watchTogetherRepoMocks.create).toHaveBeenCalledWith(7, 55, fakeClient);
        expect(episodeServiceMocks.backfillLinkedViewings).toHaveBeenCalledWith(7, "owner-1", fakeClient);
        expect(eventBusMocks.emit).not.toHaveBeenCalledWith("episode.backfilled", expect.anything());
        expect(eventBusMocks.emit).toHaveBeenCalledWith("season.watched_with.accepted", {
            recipientUserId: "owner-1", actorUserId: "friend-1", showId: 42, metadata: {seasonNumber: 1},
        });
    });

    it("re-evaluates episode achievements for whoever actually received a backfilled episode", async () => {
        userSeasonFriendRepoMocks.getStatus.mockResolvedValue(null);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        showServiceMocks.ensureSeasonTracked.mockResolvedValue(55);
        watchTogetherRepoMocks.hasConflictingLink.mockResolvedValue(false);
        userSeasonFriendRepoMocks.accept.mockResolvedValue(true);
        watchTogetherRepoMocks.create.mockResolvedValue(true);
        episodeServiceMocks.backfillLinkedViewings.mockResolvedValue(["friend-1", "owner-1"]);

        await seasonService.respondToWatchedWith("friend-1", 7, true);

        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.backfilled", {actorUserId: "friend-1"});
        expect(eventBusMocks.emit).toHaveBeenCalledWith("episode.backfilled", {actorUserId: "owner-1"});
    });

    it("rejects with a 400 when accepting an invite from someone who is no longer a friend", async () => {
        userSeasonFriendRepoMocks.getStatus.mockResolvedValue("declined");
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(seasonService.respondToWatchedWith("friend-1", 7, true)).rejects.toThrow(
            "Vous n'êtes pas en relation avec cette personne"
        );
        expect(showServiceMocks.ensureSeasonTracked).not.toHaveBeenCalled();
        expect(userSeasonFriendRepoMocks.accept).not.toHaveBeenCalled();
    });

    it("rejects with a 409 when the friend's viewing already belongs to another watch-together group", async () => {
        userSeasonFriendRepoMocks.getStatus.mockResolvedValue(null);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        showServiceMocks.ensureSeasonTracked.mockResolvedValue(55);
        watchTogetherRepoMocks.hasConflictingLink.mockResolvedValue(true);

        await expect(seasonService.respondToWatchedWith("friend-1", 7, true)).rejects.toMatchObject({status: 409});
        expect(userSeasonFriendRepoMocks.accept).not.toHaveBeenCalled();
    });

    it("throws a 500 when linking fails in the database", async () => {
        userSeasonFriendRepoMocks.getStatus.mockResolvedValue(null);
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        showServiceMocks.ensureSeasonTracked.mockResolvedValue(55);
        watchTogetherRepoMocks.hasConflictingLink.mockResolvedValue(false);
        watchTogetherRepoMocks.create.mockResolvedValue(false);

        await expect(seasonService.respondToWatchedWith("friend-1", 7, true)).rejects.toThrow(
            "Impossible d'accepter cette invitation"
        );
        expect(episodeServiceMocks.backfillLinkedViewings).not.toHaveBeenCalled();
    });
});