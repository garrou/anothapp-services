import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import ActorRepository from "./actorRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("ActorRepository.getActorById", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ActorRepository();
    });

    it("returns an Actor when found", async () => {
        db.query.mockResolvedValue({
            rowCount: 1,
            rows: [{id: 1, name: "Actor", picture: "pic.png", birthday: "1980-01-01", deathday: null, nationality: "FR", description: "desc"}],
        });

        const result = await repo.getActorById(1);

        expect(result).toEqual({id: 1, name: "Actor", picture: "pic.png", birthday: "1980-01-01", deathday: null, nationality: "FR", description: "desc"});
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getActorById(999);

        expect(result).toBeNull();
    });
});

describe("ActorRepository.createActor", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ActorRepository();
    });

    it("returns true when the actor was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.createActor(1, "Actor", "pic.png", "1980-01-01", null, "FR", "desc");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO actors"), [1, "Actor", "pic.png", "1980-01-01", null, "FR", "desc"]);
        expect(result).toBe(true);
    });

    it("defaults empty birthday/deathday to null", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.createActor(1, "Actor", "pic.png", "", "", "FR", "desc");

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [1, "Actor", "pic.png", null, null, "FR", "desc"]);
    });
});

describe("ActorRepository.getAllActors", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ActorRepository();
    });

    it("maps rows to Actor instances", async () => {
        db.query.mockResolvedValue({rows: [{id: 1, name: "Actor", picture: null, birthday: null, deathday: null, nationality: null, description: null}]});

        const result = await repo.getAllActors();

        expect(result).toEqual([{id: 1, name: "Actor", picture: null, birthday: null, deathday: null, nationality: null, description: null}]);
    });
});

describe("ActorRepository.updateActor", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new ActorRepository();
    });

    it("returns true when the actor was updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.updateActor(1, {name: "Actor", picture: "pic.png", birthday: "1980-01-01", deathday: null, nationality: "FR", description: "desc"});

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE actors"), [1, "Actor", "pic.png", "1980-01-01", null, "FR", "desc"]);
        expect(result).toBe(true);
    });

    it("returns false when no matching actor existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.updateActor(999, {name: "Actor", picture: null, birthday: null, deathday: null, nationality: null, description: null});

        expect(result).toBe(false);
    });
});
