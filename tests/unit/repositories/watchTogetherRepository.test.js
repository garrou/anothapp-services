import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import WatchTogetherRepository from "../../../repositories/watchTogetherRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("WatchTogetherRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherRepository();
    });

    it("returns true when the relation was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.create(1, 2, "friend-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO watch_together"), [1, 2, "friend-1"]);
        expect(result).toBe(true);
    });
});

describe("WatchTogetherRepository.remove", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherRepository();
    });

    it("deletes the relation for that viewing/friend pair", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.remove(1, "friend-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM watch_together"), [1, "friend-1"]);
    });
});

describe("WatchTogetherRepository.removeAllBetweenUsers", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherRepository();
    });

    it("deletes relations between the two users in either direction", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.removeAllBetweenUsers("user-1", "user-2");

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ["user-1", "user-2"]);
    });
});

describe("WatchTogetherRepository.hasConflictingLink", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherRepository();
    });

    it("returns true when either viewing is already linked elsewhere", async () => {
        db.query.mockResolvedValue({rows: [{conflict: true}]});

        expect(await repo.hasConflictingLink(1, 42)).toBe(true);
        expect(db.query).toHaveBeenCalledWith(expect.any(String), [42, 1]);
    });

    it("returns false when both viewings are free", async () => {
        db.query.mockResolvedValue({rows: [{conflict: false}]});

        expect(await repo.hasConflictingLink(1, 42)).toBe(false);
    });
});

describe("WatchTogetherRepository.getActiveForUser", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherRepository();
    });

    it("maps active watch-together relations", async () => {
        db.query.mockResolvedValue({
            rows: [{
                users_season_id: 1, show_id: 10, title: "Dexter", poster: "poster.jpg", number: 2,
                owner_id: "user-2", owner_username: "bob", owner_picture: null,
            }],
        });

        const result = await repo.getActiveForUser("user-1");

        expect(result).toEqual([{
            userSeasonId: 1, showId: 10, showTitle: "Dexter", showPoster: "poster.jpg", seasonNumber: 2,
            actor: {id: "user-2", username: "bob", picture: null},
        }]);
    });
});

describe("WatchTogetherRepository.getLinkedViewings", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherRepository();
    });

    it("maps rows to id/userId pairs", async () => {
        db.query.mockResolvedValue({rows: [{id: 2, user_id: "user-2"}]});

        const result = await repo.getLinkedViewings(1);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [1]);
        expect(result).toEqual([{id: 2, userId: "user-2"}]);
    });
});
