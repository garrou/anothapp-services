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
    getShowsToContinueByUserId: vi.fn(),
    getFavoritesByUserId: vi.fn(),
    getShowsWithNextEpisode: vi.fn(),
    getSharedShowsWithFriend: vi.fn(),
    getShowsByUserId: vi.fn(),
    getShowByUserIdByShowId: vi.fn(),
    updateFavoriteByUserIdByShowId: vi.fn(),
    updateWatchingByUserIdByShowId: vi.fn(),
    updateAddedAtByUserIdByShowId: vi.fn(),
    updateNoteByUserIdByShowId: vi.fn(),
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

    it("reuses the show already stored locally instead of calling the search API", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(validShow);
        userShowRepoMocks.create.mockResolvedValue(true);

        const result = await showService.addShow("user-1", 42, false);

        expect(result).toEqual(validShow);
        expect(searchServiceMocks.getByShowId).not.toHaveBeenCalled();
        expect(showRepoMocks.createShow).not.toHaveBeenCalled();
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
            42, "Breaking Bad", "poster.jpg", "Drame", 45, 5, "US"
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

    it("delegates to the status-based lookup when a status is given", async () => {
        userShowRepoMocks.getShowsToResumeByUserId.mockResolvedValue(["stopped-show"]);

        const result = await showService.getShows("user-1", { status: "stopped" });

        expect(result).toEqual(["stopped-show"]);
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

    it("attaches the season directly when it already exists locally", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();
        expect(searchServiceMocks.getSeasonByShowIdByNumber).not.toHaveBeenCalled();
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

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
        userSeasonRepoMocks.getDistinctByUserIdByShowId.mockResolvedValue(["season"]);
    });

    it("rejects with a 400 when no id is given", async () => {
        await expect(showService.getShowById("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("uses the season-level estimate when episode tracking is disabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(false);
        userSeasonRepoMocks.getTimeEpisodesByUserIdByShowId.mockResolvedValue([600, 10]);

        const result = await showService.getShowById("user-1", 42);

        expect(result).toEqual({seasons: ["season"], time: 600, episodes: 10});
        expect(episodeServiceMocks.getWatchedTimeAndCountByShowId).not.toHaveBeenCalled();
    });

    it("uses the actual watched episodes when episode tracking is enabled", async () => {
        userRepoMocks.hasEpisodeTrackingEnabled.mockResolvedValue(true);
        episodeServiceMocks.getWatchedTimeAndCountByShowId.mockResolvedValue([135, 3, 2]);

        const result = await showService.getShowById("user-1", 42);

        expect(result).toEqual({seasons: ["season"], time: 135, episodes: 3, distinctEpisodes: 2});
        expect(episodeServiceMocks.getWatchedTimeAndCountByShowId).toHaveBeenCalledWith("user-1", 42);
        expect(userSeasonRepoMocks.getTimeEpisodesByUserIdByShowId).not.toHaveBeenCalled();
    });
});