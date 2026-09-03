import { describe, it, expect, vi, beforeEach } from "vitest";
import ShowService from "./showService.js";

const showRepoMocks = vi.hoisted(() => ({
    getShow: vi.fn(),
    createShow: vi.fn(),
}));
const userShowRepoMocks = vi.hoisted(() => ({
    checkShowExistsByUserIdByShowId: vi.fn(),
    create: vi.fn(),
    deleteByUserIdShowId: vi.fn(),
    getShowsToResumeByUserId: vi.fn(),
    getShowsToResumeByUserIdEpisodes: vi.fn(),
    getShowsToContinueByUserId: vi.fn(),
    getShowsToContinueByUserIdEpisodes: vi.fn(),
    getShowsFinishedByUserId: vi.fn(),
    getShowsFinishedByUserIdEpisodes: vi.fn(),
    getFavoritesByUserId: vi.fn(),
    getShowsWithNextEpisode: vi.fn(),
    getSharedShowsWithFriend: vi.fn(),
    getShowsByUserId: vi.fn(),
    getShowByUserIdByShowId: vi.fn(),
    updateFavoriteByUserIdByShowId: vi.fn(),
    updateWatchingByUserIdByShowId: vi.fn(),
    updateAddedAtByUserIdByShowId: vi.fn(),
    updateNoteByUserIdByShowId: vi.fn(),
    getRecommendationsByUserId: vi.fn(),
}));
const userListRepoMocks = vi.hoisted(() => ({
    checkShowExistsByUserIdByShowId: vi.fn(),
    create: vi.fn(),
    deleteByUserIdShowId: vi.fn(),
    getListShowsByUserId: vi.fn(),
}));
const searchServiceMocks = vi.hoisted(() => ({
    getByShowId: vi.fn(),
    getSeasonByShowIdByNumber: vi.fn(),
}));
const friendRepoMocks = vi.hoisted(() => ({
    checkIfAlreadyFriend: vi.fn(),
}));
const userSeasonRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    getDistinctByUserIdByShowId: vi.fn(),
    getTimeEpisodesByUserIdByShowId: vi.fn(),
    getInfosByUserIdByShowId: vi.fn(),
}));
const seasonRepoMocks = vi.hoisted(() => ({
    getSeasonByShowIdByNumber: vi.fn(),
    createSeason: vi.fn(),
}));
const userRepoMocks = vi.hoisted(() => ({
    hasEpisodeTrackingEnabled: vi.fn(),
}));
const episodeServiceMocks = vi.hoisted(() => ({
    getWatchedTimeByShowIdBySeasonNumber: vi.fn(),
    getWatchedTimeAndCountByShowId: vi.fn(),
}));
const eventBusMocks = vi.hoisted(() => ({
    emit: vi.fn(),
}));
vi.mock("../helpers/eventBus.js", () => ({
    default: eventBusMocks,
}));
vi.mock("../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("./episodeService.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeServiceMocks; }),
}));
vi.mock("../repositories/showRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return showRepoMocks; }),
}));
vi.mock("../repositories/userShowRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userShowRepoMocks; }),
}));
vi.mock("../repositories/userListRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userListRepoMocks; }),
}));
vi.mock("./searchService.js", () => ({
    default: vi.fn().mockImplementation(function () { return searchServiceMocks; }),
}));
vi.mock("../repositories/friendRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return friendRepoMocks; }),
}));
vi.mock("../repositories/userSeasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userSeasonRepoMocks; }),
}));
vi.mock("../repositories/seasonRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return seasonRepoMocks; }),
}));

const validShow = {
    id: 42,
    title: "Breaking Bad",
    poster: "poster.jpg",
    kinds: ["Drame"],
    duration: 45,
    seasons: 5,
    country: "US",
    description: "Un prof de chimie se lance dans la méth.",
    creation: 2008,
    network: "AMC",
    language: "en",
    episodes: 62,
};

describe("ShowService.addShow", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("rejects with a 400 when no showId is given", async () => {
        await expect(showService.addShow("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 409 when the show is already in the collection", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(true);

        await expect(showService.addShow("user-1", 42, false)).rejects.toThrow(
            "Cette série est déjà dans votre collection"
        );
    });

    it("rejects with a 409 when the show is already in the watchlist", async () => {
        userListRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(true);

        await expect(showService.addShow("user-1", 42, true)).rejects.toThrow(
            "Cette série est déjà dans votre liste"
        );
    });

    it("reuses the show already stored locally instead of calling the search API, and notifies friends", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(validShow);
        userShowRepoMocks.create.mockResolvedValue(true);

        const result = await showService.addShow("user-1", 42, false);

        expect(result).toEqual(validShow);
        expect(searchServiceMocks.getByShowId).not.toHaveBeenCalled();
        expect(showRepoMocks.createShow).not.toHaveBeenCalled();
        expect(eventBusMocks.emit).toHaveBeenCalledWith("show.started", {actorUserId: "user-1", showId: 42});
    });

    it("does not notify when adding to the watchlist instead of the collection", async () => {
        userListRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(validShow);
        userListRepoMocks.create.mockResolvedValue(true);

        await showService.addShow("user-1", 42, true);

        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("fetches and persists the show from the search API when unknown locally", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(null);
        searchServiceMocks.getByShowId.mockResolvedValue(validShow);
        showRepoMocks.createShow.mockResolvedValue(true);
        userShowRepoMocks.create.mockResolvedValue(true);

        const result = await showService.addShow("user-1", 42, false);

        expect(searchServiceMocks.getByShowId).toHaveBeenCalledWith(42);
        expect(showRepoMocks.createShow).toHaveBeenCalledWith(
            42, "Breaking Bad", "poster.jpg", "Drame", 45, 5, "US",
            "Un prof de chimie se lance dans la méth.", 2008, "AMC", "en", 62
        );
        expect(result).toEqual(validShow);
    });

    it("rejects with a 400 when the show fetched from the search API is incomplete", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(null);
        searchServiceMocks.getByShowId.mockResolvedValue({ id: 42, title: "" });

        await expect(showService.addShow("user-1", 42, false)).rejects.toThrow("Série invalide");
        expect(showRepoMocks.createShow).not.toHaveBeenCalled();
    });

    it("throws a 500 when adding to the collection fails after the show is saved", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(validShow);
        userShowRepoMocks.create.mockResolvedValue(false);

        await expect(showService.addShow("user-1", 42, false)).rejects.toThrow(
            "Impossible d'ajouter la série"
        );
    });
});

describe("ShowService.deleteByShowId", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("rejects with a 400 when no id is given", async () => {
        await expect(showService.deleteByShowId("user-1", undefined, "false")).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("deletes from the collection when inList is not 'true'", async () => {
        userShowRepoMocks.deleteByUserIdShowId.mockResolvedValue(true);

        await expect(showService.deleteByShowId("user-1", 42, "false")).resolves.toBeUndefined();
        expect(userShowRepoMocks.deleteByUserIdShowId).toHaveBeenCalledWith("user-1", 42);
        expect(userListRepoMocks.deleteByUserIdShowId).not.toHaveBeenCalled();
    });

    it("deletes from the watchlist when inList is 'true' (case-insensitive)", async () => {
        userListRepoMocks.deleteByUserIdShowId.mockResolvedValue(true);

        await expect(showService.deleteByShowId("user-1", 42, "TRUE")).resolves.toBeUndefined();
        expect(userListRepoMocks.deleteByUserIdShowId).toHaveBeenCalledWith("user-1", 42);
    });

    it("throws a 500 when nothing was deleted", async () => {
        userShowRepoMocks.deleteByUserIdShowId.mockResolvedValue(false);

        await expect(showService.deleteByShowId("user-1", 42, "false")).rejects.toThrow(
            "Impossible de supprimer la série"
        );
    });
});

describe("ShowService.getShows", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("rejects with a 400 when filtering by a friendId that isn't actually a friend", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(false);

        await expect(
            showService.getShows("user-1", { friendId: "user-2" })
        ).rejects.toThrow("Vous n'êtes pas en relation avec cette personne");
    });

    it("delegates to the season-based lookup for 'stopped' when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userShowRepoMocks.getShowsToResumeByUserId.mockResolvedValue(["stopped-show"]);

        const result = await showService.getShows("user-1", { status: "stopped" });

        expect(result).toEqual(["stopped-show"]);
        expect(userShowRepoMocks.getShowsToResumeByUserIdEpisodes).not.toHaveBeenCalled();
    });

    it("delegates to the episode-based lookup for 'stopped' when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userShowRepoMocks.getShowsToResumeByUserIdEpisodes.mockResolvedValue(["stopped-show-episodes"]);

        const result = await showService.getShows("user-1", { status: "stopped" });

        expect(result).toEqual(["stopped-show-episodes"]);
        expect(userShowRepoMocks.getShowsToResumeByUserId).not.toHaveBeenCalled();
    });

    it("delegates to the season-based lookup for 'finished' when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userShowRepoMocks.getShowsFinishedByUserId.mockResolvedValue(["finished-show"]);

        const result = await showService.getShows("user-1", { status: "finished" });

        expect(result).toEqual(["finished-show"]);
        expect(userShowRepoMocks.getShowsFinishedByUserIdEpisodes).not.toHaveBeenCalled();
    });

    it("delegates to the episode-based lookup for 'finished' when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userShowRepoMocks.getShowsFinishedByUserIdEpisodes.mockResolvedValue(["finished-show-episodes"]);

        const result = await showService.getShows("user-1", { status: "finished" });

        expect(result).toEqual(["finished-show-episodes"]);
        expect(userShowRepoMocks.getShowsFinishedByUserId).not.toHaveBeenCalled();
    });

    it("delegates to the season-based lookup for 'continue' when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userShowRepoMocks.getShowsToContinueByUserId.mockResolvedValue(["continue-show"]);

        const result = await showService.getShows("user-1", { status: "continue" });

        expect(result).toEqual(["continue-show"]);
        expect(userShowRepoMocks.getShowsToContinueByUserIdEpisodes).not.toHaveBeenCalled();
    });

    it("delegates to the episode-based lookup for 'continue' when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        userShowRepoMocks.getShowsToContinueByUserIdEpisodes.mockResolvedValue(["continue-show-episodes"]);

        const result = await showService.getShows("user-1", { status: "continue" });

        expect(result).toEqual(["continue-show-episodes"]);
        expect(userShowRepoMocks.getShowsToContinueByUserId).not.toHaveBeenCalled();
    });

    it("rejects with a 400 for an unknown status", async () => {
        await expect(
            showService.getShows("user-1", { status: "unknown-status" })
        ).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 for status=shared without a friendId", async () => {
        await expect(
            showService.getShows("user-1", { status: "shared" })
        ).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 for status=all without a friendId", async () => {
        await expect(
            showService.getShows("user-1", { status: "all" })
        ).rejects.toThrow("Requête invalide");
    });

    it("returns the friend's full unfiltered collection for status=all", async () => {
        friendRepoMocks.checkIfAlreadyFriend.mockResolvedValue(true);
        userShowRepoMocks.getShowsByUserId.mockResolvedValue(["friend-show"]);

        const result = await showService.getShows("user-1", { status: "all", friendId: "user-2" });

        expect(result).toEqual(["friend-show"]);
        expect(userShowRepoMocks.getShowsByUserId).toHaveBeenCalledWith("user-2", undefined, [], [], [], []);
    });

    it("falls back to the filtered listing when no status is given", async () => {
        userShowRepoMocks.getShowsByUserId.mockResolvedValue(["filtered-show"]);

        const result = await showService.getShows("user-1", {
            title: "Breaking",
            platforms: "1,2",
            countries: "US,FR",
            kinds: "Drame",
            notes: "4,5",
        });

        expect(result).toEqual(["filtered-show"]);
        expect(userShowRepoMocks.getShowsByUserId).toHaveBeenCalledWith(
            "user-1", "Breaking", [1, 2], ["US", "FR"], ["Drame"], [4, 5]
        );
    });
});

describe("ShowService.addSeason", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("rejects with a 400 when id or num is missing", async () => {
        await expect(showService.addSeason("user-1", undefined, 1)).rejects.toThrow("Requête invalide");
        await expect(showService.addSeason("user-1", 42, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the show isn't in the user's collection", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue(null);

        await expect(showService.addSeason("user-1", 42, 1)).rejects.toThrow(
            "Cette série n'est pas dans votre collection"
        );
    });

    it("attaches the season directly when it already exists locally, and notifies friends when tracking is off", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();
        expect(searchServiceMocks.getSeasonByShowIdByNumber).not.toHaveBeenCalled();
        expect(eventBusMocks.emit).toHaveBeenCalledWith("season.watched", {
            actorUserId: "user-1", showId: 42, metadata: {seasonNumber: 1},
        });
    });

    it("stays silent when episode tracking is enabled - episode events cover it instead", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);

        await showService.addSeason("user-1", 42, 1);

        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });

    it("fetches, creates and attaches the season when it doesn't exist locally yet", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "show-poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue(null);
        searchServiceMocks.getSeasonByShowIdByNumber.mockResolvedValue({
            episodes: 10, number: 1, image: null,
        });
        seasonRepoMocks.createSeason.mockResolvedValue(true);
        userSeasonRepoMocks.create.mockResolvedValue(true);

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();
        // falls back to the show's poster when the season has none of its own
        expect(seasonRepoMocks.createSeason).toHaveBeenCalledWith(10, 1, "show-poster.jpg", 42);
    });

    it("throws when the season can't be found via the search API either", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue(null);
        searchServiceMocks.getSeasonByShowIdByNumber.mockResolvedValue(null);

        await expect(showService.addSeason("user-1", 42, 1)).rejects.toThrow(
            "Impossible d'ajouter la saison"
        );
    });

});

describe("ShowService.updateByShowId", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("rejects with a 400 when no id is given", async () => {
        await expect(showService.updateByShowId("user-1", undefined, {})).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("rejects with a 400 when the body has none of the recognized fields", async () => {
        await expect(showService.updateByShowId("user-1", 42, {})).rejects.toThrow("Requête invalide");
    });

    it("toggles favorite when favorite is set", async () => {
        userShowRepoMocks.updateFavoriteByUserIdByShowId.mockResolvedValue(true);

        const result = await showService.updateByShowId("user-1", 42, { favorite: true });

        expect(result).toBe(true);
        expect(userShowRepoMocks.updateFavoriteByUserIdByShowId).toHaveBeenCalledWith("user-1", 42);
    });

    it("rejects a future addedAt date", async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();

        await expect(
            showService.updateByShowId("user-1", 42, { addedAt: futureDate })
        ).rejects.toThrow("Date invalide");
    });

    it("accepts a past addedAt date", async () => {
        userShowRepoMocks.updateAddedAtByUserIdByShowId.mockResolvedValue(true);
        const pastDate = new Date(Date.now() - 86400000).toISOString();

        const result = await showService.updateByShowId("user-1", 42, { addedAt: pastDate });

        expect(result).toBe(true);
    });

    it("sets the note and notifies friends", async () => {
        userShowRepoMocks.updateNoteByUserIdByShowId.mockResolvedValue(true);

        const result = await showService.updateByShowId("user-1", 42, { note: 3 });

        expect(result).toBe(true);
        expect(eventBusMocks.emit).toHaveBeenCalledWith("show.rated", {
            actorUserId: "user-1", showId: 42, metadata: {noteId: 3},
        });
    });

    it("does not notify when setting the note fails", async () => {
        userShowRepoMocks.updateNoteByUserIdByShowId.mockResolvedValue(false);

        const result = await showService.updateByShowId("user-1", 42, { note: 3 });

        expect(result).toBe(false);
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });
});

describe("ShowService.getSeasonWatchedTime", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("returns null without querying episode time when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);

        const result = await showService.getSeasonWatchedTime("user-1", 42, 1);

        expect(result).toBeNull();
        expect(episodeServiceMocks.getWatchedTimeByShowIdBySeasonNumber).not.toHaveBeenCalled();
    });

    it("returns the watched time from episodes when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        episodeServiceMocks.getWatchedTimeByShowIdBySeasonNumber.mockResolvedValue(90);

        const result = await showService.getSeasonWatchedTime("user-1", 42, 1);

        expect(result).toBe(90);
        expect(episodeServiceMocks.getWatchedTimeByShowIdBySeasonNumber).toHaveBeenCalledWith("user-1", 42, 1);
    });
});

describe("ShowService.getShowById", () => {
    let showService;

    const storedShow = {id: 42, title: "Breaking Bad"};

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue(storedShow);
        userSeasonRepoMocks.getDistinctByUserIdByShowId.mockResolvedValue(["season"]);
    });

    it("rejects with a 400 when no id is given", async () => {
        await expect(showService.getShowById("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 404 when the show isn't in the user's collection", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue(null);

        await expect(showService.getShowById("user-1", 42)).rejects.toThrow("Série introuvable");
        expect(userSeasonRepoMocks.getDistinctByUserIdByShowId).not.toHaveBeenCalled();
    });

    it("uses the season-level estimate when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userSeasonRepoMocks.getTimeEpisodesByUserIdByShowId.mockResolvedValue([600, 10]);

        const result = await showService.getShowById("user-1", 42);

        expect(result).toEqual({serie: storedShow, seasons: ["season"], time: 600, episodes: 10});
        expect(episodeServiceMocks.getWatchedTimeAndCountByShowId).not.toHaveBeenCalled();
    });

    it("uses the actual watched episodes when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        episodeServiceMocks.getWatchedTimeAndCountByShowId.mockResolvedValue([135, 3, 2]);

        const result = await showService.getShowById("user-1", 42);

        expect(result).toEqual({serie: storedShow, seasons: ["season"], time: 135, episodes: 3, distinctEpisodes: 2});
        expect(episodeServiceMocks.getWatchedTimeAndCountByShowId).toHaveBeenCalledWith("user-1", 42);
        expect(userSeasonRepoMocks.getTimeEpisodesByUserIdByShowId).not.toHaveBeenCalled();
    });
});

describe("ShowService.getRecommendations", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("delegates to the repository for the current user", async () => {
        const recommendations = [{id: 1, title: "Dark", nbFriends: 2, avgNote: 4.5}];
        userShowRepoMocks.getRecommendationsByUserId.mockResolvedValue(recommendations);

        const result = await showService.getRecommendations("user-1");

        expect(result).toBe(recommendations);
        expect(userShowRepoMocks.getRecommendationsByUserId).toHaveBeenCalledWith("user-1");
    });
});