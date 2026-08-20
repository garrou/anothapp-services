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
const searchServiceMocks = vi.hoisted(() => ({
    getByShowId: vi.fn(),
    getSeasonByShowIdByNumber: vi.fn(),
    getEpisodesByShowIdBySeason: vi.fn(),
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
const episodeRepoMocks = vi.hoisted(() => ({
    hasEpisodesByShowIdBySeason: vi.fn(),
    createEpisode: vi.fn(),
    getEpisodeById: vi.fn(),
    getEpisodesWithWatchedStatus: vi.fn(),
}));
const userEpisodeRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
}));

vi.mock("../repositories/showRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return showRepoMocks; }),
}));
vi.mock("../repositories/userShowRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userShowRepoMocks; }),
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
vi.mock("../repositories/episodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeRepoMocks; }),
}));
vi.mock("../repositories/userEpisodeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userEpisodeRepoMocks; }),
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

        await expect(showService.addShow("user-1", 42)).rejects.toThrow(
            "Cette série est déjà dans votre collection"
        );
    });

    it("reuses the show already stored locally instead of calling the search API", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(validShow);
        userShowRepoMocks.create.mockResolvedValue(true);

        const result = await showService.addShow("user-1", 42);

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

        const result = await showService.addShow("user-1", 42);

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

        await expect(showService.addShow("user-1", 42)).rejects.toThrow("Série invalide");
        expect(showRepoMocks.createShow).not.toHaveBeenCalled();
    });

    it("throws a 500 when adding to the collection fails after the show is saved", async () => {
        userShowRepoMocks.checkShowExistsByUserIdByShowId.mockResolvedValue(false);
        showRepoMocks.getShow.mockResolvedValue(validShow);
        userShowRepoMocks.create.mockResolvedValue(false);

        await expect(showService.addShow("user-1", 42)).rejects.toThrow(
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
        await expect(showService.deleteByShowId("user-1", undefined)).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("deletes the show from the collection", async () => {
        userShowRepoMocks.deleteByUserIdShowId.mockResolvedValue(true);

        await expect(showService.deleteByShowId("user-1", 42)).resolves.toBeUndefined();
        expect(userShowRepoMocks.deleteByUserIdShowId).toHaveBeenCalledWith("user-1", 42);
    });

    it("throws a 500 when nothing was deleted", async () => {
        userShowRepoMocks.deleteByUserIdShowId.mockResolvedValue(false);

        await expect(showService.deleteByShowId("user-1", 42)).rejects.toThrow(
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
        // episodes already populated by default: keeps the pre-existing tests
        // focused on the season logic, episode population is covered below
        episodeRepoMocks.hasEpisodesByShowIdBySeason.mockResolvedValue(true);
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

    it("populates the episodes table when they aren't stored locally yet", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);
        episodeRepoMocks.hasEpisodesByShowIdBySeason.mockResolvedValue(false);
        searchServiceMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1001, title: "Ep 1", number: 1, season: 1, code: "S01E01", global: 1, length: 21, date: "2024-01-01" },
            { id: 1002, title: "Ep 2", number: 2, season: 1, code: "S01E02", global: 2, length: 21, date: "2024-01-08" },
        ]);

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();

        expect(episodeRepoMocks.createEpisode).toHaveBeenCalledTimes(2);
        expect(episodeRepoMocks.createEpisode).toHaveBeenCalledWith(
            1001, "Ep 1", 1, 1, "S01E01", 1, 21, "2024-01-01", 42
        );
    });

    it("does not fetch episodes again when they are already stored locally", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);
        episodeRepoMocks.hasEpisodesByShowIdBySeason.mockResolvedValue(true);

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();

        expect(searchServiceMocks.getEpisodesByShowIdBySeason).not.toHaveBeenCalled();
        expect(episodeRepoMocks.createEpisode).not.toHaveBeenCalled();
    });

    it("does not block adding the season when episode population fails", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);
        episodeRepoMocks.hasEpisodesByShowIdBySeason.mockRejectedValue(new Error("db down"));

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();
        expect(userSeasonRepoMocks.create).toHaveBeenCalledWith("user-1", 42, 1);
    });

    it("does not block adding the season when the BetaSeries episodes call fails", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);
        episodeRepoMocks.hasEpisodesByShowIdBySeason.mockResolvedValue(false);
        searchServiceMocks.getEpisodesByShowIdBySeason.mockRejectedValue(new Error("BetaSeries down"));

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();
        expect(episodeRepoMocks.createEpisode).not.toHaveBeenCalled();
        expect(userSeasonRepoMocks.create).toHaveBeenCalledWith("user-1", 42, 1);
    });

    it("does not block adding the season when one of the episode inserts fails", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42, poster: "poster.jpg" });
        seasonRepoMocks.getSeasonByShowIdByNumber.mockResolvedValue({ id: 1, number: 1 });
        userSeasonRepoMocks.create.mockResolvedValue(true);
        episodeRepoMocks.hasEpisodesByShowIdBySeason.mockResolvedValue(false);
        searchServiceMocks.getEpisodesByShowIdBySeason.mockResolvedValue([
            { id: 1001, title: "Ep 1", number: 1, season: 1, code: "S01E01", global: 1, length: 21, date: "2024-01-01" },
        ]);
        episodeRepoMocks.createEpisode.mockRejectedValue(new Error("constraint violation"));

        await expect(showService.addSeason("user-1", 42, 1)).resolves.toBeUndefined();
        expect(userSeasonRepoMocks.create).toHaveBeenCalledWith("user-1", 42, 1);
    });
});

describe("ShowService.addEpisode", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("rejects with a 400 when id or episodeId is missing", async () => {
        await expect(showService.addEpisode("user-1", undefined, 1001)).rejects.toThrow("Requête invalide");
        await expect(showService.addEpisode("user-1", 42, undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the show isn't in the user's collection", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue(null);

        await expect(showService.addEpisode("user-1", 42, 1001)).rejects.toThrow(
            "Cette série n'est pas dans votre collection"
        );
    });

    it("rejects with a 400 when the episode doesn't exist locally", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42 });
        episodeRepoMocks.getEpisodeById.mockResolvedValue(null);

        await expect(showService.addEpisode("user-1", 42, 1001)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 400 when the episode belongs to another show", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42 });
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1001, showId: 99 });

        await expect(showService.addEpisode("user-1", 42, 1001)).rejects.toThrow("Requête invalide");
    });

    it("marks the episode as watched with no explicit platform when the season has no viewing", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42 });
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1001, showId: 42, season: 1 });
        userSeasonRepoMocks.getInfosByUserIdByShowId.mockResolvedValue([]);
        userEpisodeRepoMocks.create.mockResolvedValue(true);

        await expect(showService.addEpisode("user-1", 42, 1001)).resolves.toBeUndefined();
        expect(userSeasonRepoMocks.getInfosByUserIdByShowId).toHaveBeenCalledWith("user-1", 42, 1);
        expect(userEpisodeRepoMocks.create).toHaveBeenCalledWith("user-1", 1001, undefined);
    });

    it("defaults the episode's platform to the season's most recent viewing platform", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42 });
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1001, showId: 42, season: 1 });
        userSeasonRepoMocks.getInfosByUserIdByShowId.mockResolvedValue([
            { id: 1, platform: { id: 1, name: "Netflix" } },
            { id: 2, platform: { id: 3, name: "Prime Video" } },
        ]);
        userEpisodeRepoMocks.create.mockResolvedValue(true);

        await expect(showService.addEpisode("user-1", 42, 1001)).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.create).toHaveBeenCalledWith("user-1", 1001, 3);
    });

    it("throws a 500 when marking the episode as watched fails", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42 });
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1001, showId: 42, season: 1 });
        userSeasonRepoMocks.getInfosByUserIdByShowId.mockResolvedValue([]);
        userEpisodeRepoMocks.create.mockResolvedValue(false);

        await expect(showService.addEpisode("user-1", 42, 1001)).rejects.toThrow(
            "Impossible d'ajouter l'épisode"
        );
    });

    it("matches the episode's show even when id arrives as a string (route/body param)", async () => {
        userShowRepoMocks.getShowByUserIdByShowId.mockResolvedValue({ id: 42 });
        episodeRepoMocks.getEpisodeById.mockResolvedValue({ id: 1001, showId: 42, season: 1 });
        userSeasonRepoMocks.getInfosByUserIdByShowId.mockResolvedValue([]);
        userEpisodeRepoMocks.create.mockResolvedValue(true);

        await expect(showService.addEpisode("user-1", "42", 1001)).resolves.toBeUndefined();
        expect(userEpisodeRepoMocks.create).toHaveBeenCalledWith("user-1", 1001, undefined);
    });
});

describe("ShowService.getEpisodesByShowIdBySeason", () => {
    let showService;

    beforeEach(() => {
        vi.clearAllMocks();
        showService = new ShowService();
    });

    it("rejects with a 400 when id or num is missing", async () => {
        await expect(showService.getEpisodesByShowIdBySeason("user-1", undefined, 1)).rejects.toThrow(
            "Requête invalide"
        );
        await expect(showService.getEpisodesByShowIdBySeason("user-1", 42, undefined)).rejects.toThrow(
            "Requête invalide"
        );
    });

    it("delegates to the repository", async () => {
        episodeRepoMocks.getEpisodesWithWatchedStatus.mockResolvedValue(["episode-with-status"]);

        const result = await showService.getEpisodesByShowIdBySeason("user-1", 42, 1);

        expect(result).toEqual(["episode-with-status"]);
        expect(episodeRepoMocks.getEpisodesWithWatchedStatus).toHaveBeenCalledWith("user-1", 42, 1);
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