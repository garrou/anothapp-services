import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import UserRepository from "./userRepository.js";
import ServiceError from "../helpers/serviceError.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

const validUserRow = {id: "user-1", email: "a@b.com", picture: null, username: "bob", password: "hash", last_export: null, episode_tracking_enabled: false, created_at: "2024-01-01"};

describe("UserRepository.getUserByEmail", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns a User when found", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [validUserRow]});

        const result = await repo.getUserByEmail("a@b.com");

        expect(result.id).toBe("user-1");
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getUserByEmail("unknown@b.com");

        expect(result).toBeNull();
    });
});

describe("UserRepository.getUsersByUsername", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("uses an exact match query when strict", async () => {
        db.query.mockResolvedValue({rows: [validUserRow]});

        const result = await repo.getUsersByUsername("bob", true);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPPER(username) = UPPER($1)"), ["bob"]);
        expect(result).toEqual([expect.objectContaining({id: "user-1"})]);
    });

    it("uses a LIKE query with a limit when not strict", async () => {
        db.query.mockResolvedValue({rows: []});

        await repo.getUsersByUsername("bo");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("LIKE"), ["%bo%", 10]);
    });
});

describe("UserRepository.getUserByIdentifier", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns a User when found", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [validUserRow]});

        const result = await repo.getUserByIdentifier("bob");

        expect(result.username).toBe("bob");
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getUserByIdentifier("unknown");

        expect(result).toBeNull();
    });
});

describe("UserRepository.getUserById", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns a User when found", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [validUserRow]});

        const result = await repo.getUserById("user-1");

        expect(result.id).toBe("user-1");
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getUserById("unknown");

        expect(result).toBeNull();
    });
});

describe("UserRepository.getUserCount", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns the parsed count", async () => {
        db.query.mockResolvedValue({rows: [{total: "42"}]});

        const result = await repo.getUserCount();

        expect(result).toBe(42);
    });
});

describe("UserRepository.getAllUserIds", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns the list of ids", async () => {
        db.query.mockResolvedValue({rows: [{id: "user-1"}, {id: "user-2"}]});

        const result = await repo.getAllUserIds();

        expect(result).toEqual(["user-1", "user-2"]);
    });
});

describe("UserRepository.hasEpisodeTrackingEnabled", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when enabled", async () => {
        db.query.mockResolvedValue({rows: [{episode_tracking_enabled: true}]});

        const result = await repo.hasEpisodeTrackingEnabled("user-1");

        expect(result).toBe(true);
    });

    it("returns false when the user does not exist", async () => {
        db.query.mockResolvedValue({rows: []});

        const result = await repo.hasEpisodeTrackingEnabled("unknown");

        expect(result).toBe(false);
    });
});

describe("UserRepository.getEpisodeTrackingByIds", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns an empty Map without querying when ids is empty", async () => {
        const result = await repo.getEpisodeTrackingByIds([]);

        expect(db.query).not.toHaveBeenCalled();
        expect(result.size).toBe(0);
    });

    it("returns a Map keyed by id", async () => {
        db.query.mockResolvedValue({rows: [{id: "user-1", episode_tracking_enabled: true}, {id: "user-2", episode_tracking_enabled: false}]});

        const result = await repo.getEpisodeTrackingByIds(["user-1", "user-2"]);

        expect(result.get("user-1")).toBe(true);
        expect(result.get("user-2")).toBe(false);
    });
});

describe("UserRepository.createUser", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when the user was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.createUser("a@b.com", "hash", "bob");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users"), ["a@b.com", "hash", "bob"]);
        expect(result).toBe(true);
    });
});

describe("UserRepository.updateField", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when a valid field was updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.updateField("user-1", "picture", "new.png");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users"), ["new.png", "user-1"]);
        expect(result).toBe(true);
    });

    it("throws a ServiceError for an invalid field", async () => {
        await expect(repo.updateField("user-1", "is_admin", "true")).rejects.toBeInstanceOf(ServiceError);
        expect(db.query).not.toHaveBeenCalled();
    });
});

describe("UserRepository.markExported", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when the user was marked exported", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.markExported("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users"), ["user-1"]);
        expect(result).toBe(true);
    });

    it("returns false when the user was already exported recently", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.markExported("user-1");

        expect(result).toBe(false);
    });
});
