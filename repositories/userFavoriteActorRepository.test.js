import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserFavoriteActorRepository from "./userFavoriteActorRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("UserFavoriteActorRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserFavoriteActorRepository();
    });

    it("returns true when a row was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.create("user-1", 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_favorite_actors"), ["user-1", 1]);
        expect(result).toBe(true);
    });
});

describe("UserFavoriteActorRepository.deleteByUserIdActorId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserFavoriteActorRepository();
    });

    it("returns true when a row was deleted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.deleteByUserIdActorId("user-1", 1);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM users_favorite_actors"), ["user-1", 1]);
        expect(result).toBe(true);
    });

    it("returns false when no matching row existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.deleteByUserIdActorId("user-1", 999);

        expect(result).toBe(false);
    });
});

describe("UserFavoriteActorRepository.checkFavoriteExists", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserFavoriteActorRepository();
    });

    it("returns true when the favorite exists", async () => {
        db.query.mockResolvedValue({rows: [{total: "1"}]});

        const result = await repo.checkFavoriteExists("user-1", 1);

        expect(result).toBe(true);
    });

    it("returns false when the favorite does not exist", async () => {
        db.query.mockResolvedValue({rows: [{total: "0"}]});

        const result = await repo.checkFavoriteExists("user-1", 999);

        expect(result).toBe(false);
    });
});

describe("UserFavoriteActorRepository.getFavoritesByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserFavoriteActorRepository();
    });

    it("maps rows to Actor instances", async () => {
        db.query.mockResolvedValue({rows: [{id: 1, name: "Actor", picture: null, birthday: null, deathday: null, nationality: null, description: null}]});

        const result = await repo.getFavoritesByUserId("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM actors"), ["user-1"]);
        expect(result).toEqual([{id: 1, name: "Actor", picture: null, birthday: null, deathday: null, nationality: null, description: null}]);
    });

    it("returns an empty array when the user has no favorites", async () => {
        db.query.mockResolvedValue({rows: []});

        const result = await repo.getFavoritesByUserId("user-1");

        expect(result).toEqual([]);
    });
});
