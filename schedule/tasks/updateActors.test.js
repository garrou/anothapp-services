import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import updateActors from "./updateActors.js";

const actorRepoMocks = vi.hoisted(() => ({
    getAllActors: vi.fn(),
    updateActor: vi.fn(),
}));
const betaseriesMocks = vi.hoisted(() => ({
    fetchPerson: vi.fn(),
}));

vi.mock("../../repositories/actorRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return actorRepoMocks; }),
}));
vi.mock("../lib/betaseries.js", () => ({default: betaseriesMocks}));

const dbActor = {id: 34100, name: "Rami Malek"};

const apiPerson = {
    name: "Rami Malek",
    poster: "https://pictures.betaseries.com/persons/rami.jpg",
    birthday: "1981-05-12",
    deathday: null,
    nationality: "États-Unis",
    description: "Acteur américain.",
};

describe("updateActors", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        actorRepoMocks.updateActor.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("skips the sync entirely outside the weekly sync day", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-02")); // a Tuesday

        const result = await updateActors();

        expect(result).toEqual({skipped: true, updated: 0, toDelete: [], failed: []});
        expect(actorRepoMocks.getAllActors).not.toHaveBeenCalled();
    });

    it("syncs every actor unconditionally on the weekly sync day", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-07")); // a Sunday
        actorRepoMocks.getAllActors.mockResolvedValue([dbActor]);
        betaseriesMocks.fetchPerson.mockResolvedValue(apiPerson);

        const result = await updateActors();

        expect(actorRepoMocks.updateActor).toHaveBeenCalledWith(34100, {
            deleted: false,
            name: "Rami Malek",
            picture: "https://pictures.betaseries.com/persons/rami.jpg",
            birthday: "1981-05-12",
            deathday: null,
            nationality: "États-Unis",
            description: "Acteur américain.",
        });
        expect(result).toEqual({skipped: false, updated: 1, toDelete: [], failed: []});
    });

    it("flags an actor that no longer exists on BetaSeries instead of deleting it", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-07"));
        actorRepoMocks.getAllActors.mockResolvedValue([dbActor]);
        betaseriesMocks.fetchPerson.mockResolvedValue(null);

        const result = await updateActors();

        expect(actorRepoMocks.updateActor).not.toHaveBeenCalled();
        expect(result.toDelete).toEqual([dbActor]);
    });

    it("reports a failure without aborting the other actors", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-07"));
        const otherActor = {id: 99, name: "Other Actor"};
        actorRepoMocks.getAllActors.mockResolvedValue([dbActor, otherActor]);
        betaseriesMocks.fetchPerson.mockImplementation(async (id) => {
            if (id === 34100) throw new Error("network down");
            return apiPerson;
        });

        const result = await updateActors();

        expect(result.failed).toEqual([{id: 34100, name: "Rami Malek", error: "network down"}]);
        expect(result.updated).toEqual(1);
    });
});
