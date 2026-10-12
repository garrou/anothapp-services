import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import WatchTogetherAutoAcceptRepository from "../../../repositories/watchTogetherAutoAcceptRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("WatchTogetherAutoAcceptRepository.checkEnabled", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherAutoAcceptRepository();
    });

    it("returns true when a row exists", async () => {
        db.query.mockResolvedValue({rows: [{total: "1"}]});

        const result = await repo.checkEnabled("user-1", "user-2");

        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM users_auto_accept_watch_together"), ["user-1", "user-2"]);
    });

    it("returns false when no row exists", async () => {
        db.query.mockResolvedValue({rows: [{total: "0"}]});

        const result = await repo.checkEnabled("user-1", "user-2");

        expect(result).toBe(false);
    });
});

describe("WatchTogetherAutoAcceptRepository.enable", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherAutoAcceptRepository();
    });

    it("inserts the row", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.enable("user-1", "user-2");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users_auto_accept_watch_together"), ["user-1", "user-2"]);
    });
});

describe("WatchTogetherAutoAcceptRepository.disable", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherAutoAcceptRepository();
    });

    it("deletes the row", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.disable("user-1", "user-2");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM users_auto_accept_watch_together"), ["user-1", "user-2"]);
    });
});

describe("WatchTogetherAutoAcceptRepository.removeAllBetweenUsers", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new WatchTogetherAutoAcceptRepository();
    });

    it("deletes rows in either direction using the given client", async () => {
        const client = {query: vi.fn().mockResolvedValue({})};

        await repo.removeAllBetweenUsers("user-1", "user-2", client);

        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM users_auto_accept_watch_together"), ["user-1", "user-2"]);
        expect(db.query).not.toHaveBeenCalled();
    });
});
