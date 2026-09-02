import { describe, it, expect, vi, beforeEach } from "vitest";
import ActorService from "./actorService.js";

const actorRepoMocks = vi.hoisted(() => ({
    getActorById: vi.fn(),
    createActor: vi.fn(),
}));
const userFavoriteActorRepoMocks = vi.hoisted(() => ({
    checkFavoriteExists: vi.fn(),
    create: vi.fn(),
    deleteByUserIdActorId: vi.fn(),
    getFavoritesByUserId: vi.fn(),
}));
const searchServiceMocks = vi.hoisted(() => ({
    getPersonById: vi.fn(),
}));
const eventBusMocks = vi.hoisted(() => ({
    emit: vi.fn(),
}));
vi.mock("../helpers/eventBus.js", () => ({
    default: eventBusMocks,
}));
vi.mock("../repositories/actorRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return actorRepoMocks; }),
}));
vi.mock("../repositories/userFavoriteActorRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userFavoriteActorRepoMocks; }),
}));
vi.mock("./searchService.js", () => ({
    default: vi.fn().mockImplementation(function () { return searchServiceMocks; }),
}));

const storedActor = {
    id: 34100,
    name: "Rami Malek",
    picture: "https://pictures.betaseries.com/persons/rami.jpg",
    birthday: "1981-05-12",
    deathday: null,
    nationality: "États-Unis",
    description: "Acteur américain.",
};

const validPerson = {
    id: 34100,
    name: "Rami Malek",
    poster: "https://pictures.betaseries.com/persons/rami.jpg",
    birthday: "1981-05-12",
    deathday: null,
    nationality: "États-Unis",
    description: "Acteur américain.",
};

describe("ActorService.addFavorite", () => {
    let actorService;

    beforeEach(() => {
        vi.clearAllMocks();
        actorService = new ActorService();
    });

    it("rejects with a 400 when no actorId is given", async () => {
        await expect(actorService.addFavorite("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("rejects with a 409 when the actor is already a favorite", async () => {
        userFavoriteActorRepoMocks.checkFavoriteExists.mockResolvedValue(true);

        await expect(actorService.addFavorite("user-1", 34100)).rejects.toThrow(
            "Cet acteur est déjà dans vos favoris"
        );
        expect(searchServiceMocks.getPersonById).not.toHaveBeenCalled();
    });

    it("reuses the actor already stored locally instead of calling the search API, and notifies friends", async () => {
        userFavoriteActorRepoMocks.checkFavoriteExists.mockResolvedValue(false);
        actorRepoMocks.getActorById.mockResolvedValue(storedActor);
        userFavoriteActorRepoMocks.create.mockResolvedValue(true);

        const result = await actorService.addFavorite("user-1", 34100);

        expect(result).toEqual(storedActor);
        expect(searchServiceMocks.getPersonById).not.toHaveBeenCalled();
        expect(actorRepoMocks.createActor).not.toHaveBeenCalled();
        expect(eventBusMocks.emit).toHaveBeenCalledWith("actor.favorited", {
            actorUserId: "user-1",
            metadata: {actorId: 34100, actorName: "Rami Malek", actorPicture: storedActor.picture},
        });
    });

    it("fetches and persists the actor from the search API when unknown locally", async () => {
        userFavoriteActorRepoMocks.checkFavoriteExists.mockResolvedValue(false);
        actorRepoMocks.getActorById
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(storedActor);
        searchServiceMocks.getPersonById.mockResolvedValue(validPerson);
        actorRepoMocks.createActor.mockResolvedValue(true);
        userFavoriteActorRepoMocks.create.mockResolvedValue(true);

        const result = await actorService.addFavorite("user-1", 34100);

        expect(searchServiceMocks.getPersonById).toHaveBeenCalledWith(34100);
        expect(actorRepoMocks.createActor).toHaveBeenCalledWith(
            34100, "Rami Malek", "https://pictures.betaseries.com/persons/rami.jpg",
            "1981-05-12", null, "États-Unis", "Acteur américain."
        );
        expect(result).toEqual(storedActor);
    });

    it("rejects with a 400 when the person fetched from the search API is incomplete", async () => {
        userFavoriteActorRepoMocks.checkFavoriteExists.mockResolvedValue(false);
        actorRepoMocks.getActorById.mockResolvedValue(null);
        searchServiceMocks.getPersonById.mockResolvedValue({ id: undefined, name: "" });

        await expect(actorService.addFavorite("user-1", 34100)).rejects.toThrow("Acteur invalide");
        expect(actorRepoMocks.createActor).not.toHaveBeenCalled();
    });

    it("throws a 500 when adding the favorite fails after the actor is saved", async () => {
        userFavoriteActorRepoMocks.checkFavoriteExists.mockResolvedValue(false);
        actorRepoMocks.getActorById.mockResolvedValue(storedActor);
        userFavoriteActorRepoMocks.create.mockResolvedValue(false);

        await expect(actorService.addFavorite("user-1", 34100)).rejects.toThrow(
            "Impossible d'ajouter l'acteur aux favoris"
        );
        expect(eventBusMocks.emit).not.toHaveBeenCalled();
    });
});

describe("ActorService.removeFavorite", () => {
    let actorService;

    beforeEach(() => {
        vi.clearAllMocks();
        actorService = new ActorService();
    });

    it("rejects with a 400 when no actorId is given", async () => {
        await expect(actorService.removeFavorite("user-1", undefined)).rejects.toThrow("Requête invalide");
    });

    it("throws a 500 when nothing was deleted", async () => {
        userFavoriteActorRepoMocks.deleteByUserIdActorId.mockResolvedValue(false);

        await expect(actorService.removeFavorite("user-1", 34100)).rejects.toThrow(
            "Impossible de supprimer l'acteur des favoris"
        );
    });

    it("succeeds when the favorite is deleted", async () => {
        userFavoriteActorRepoMocks.deleteByUserIdActorId.mockResolvedValue(true);

        await expect(actorService.removeFavorite("user-1", 34100)).resolves.toBeUndefined();
    });
});

describe("ActorService.getFavorites", () => {
    it("returns the favorites for the user", async () => {
        userFavoriteActorRepoMocks.getFavoritesByUserId.mockResolvedValue([storedActor]);
        const actorService = new ActorService();

        const result = await actorService.getFavorites("user-1");

        expect(userFavoriteActorRepoMocks.getFavoritesByUserId).toHaveBeenCalledWith("user-1");
        expect(result).toEqual([storedActor]);
    });
});
