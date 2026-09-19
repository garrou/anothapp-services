import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import UserRepository from "../../../repositories/userRepository.js";
import ServiceError from "../../../helpers/serviceError.js";

vi.mock("../../../config/db.js", () => ({
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

    it("matches both username and email case-insensitively", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [validUserRow]});

        await repo.getUserByIdentifier("bob");

        const [query] = db.query.mock.calls[0];
        expect(query).toContain("UPPER(username) = UPPER($1)");
        expect(query).toContain("UPPER(email) = UPPER($1)");
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

    it("returns the created user's id when the user was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{id: "user-1"}]});

        const result = await repo.createUser("a@b.com", "hash", "bob");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO users"), ["a@b.com", "hash", "bob"]);
        expect(result).toBe("user-1");
    });

    it("returns null when nothing was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.createUser("a@b.com", "hash", "bob");

        expect(result).toBeNull();
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

describe("UserRepository.confirmPendingEmail", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when a pending email was moved into email", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.confirmPendingEmail("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("SET email = pending_email"), ["user-1"]);
        expect(result).toBe(true);
    });

    it("returns false when the user has no pending email", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.confirmPendingEmail("user-1");

        expect(result).toBe(false);
    });
});

describe("UserRepository.setLoginChallenge", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when the challenge was stored", async () => {
        db.query.mockResolvedValue({rowCount: 1});
        const expiresAt = new Date();

        const result = await repo.setLoginChallenge("user-1", "hash", expiresAt);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET login_code_hash = $1, login_code_expires_at = $2, login_code_attempts = 0"),
            ["hash", expiresAt, "user-1"]
        );
        expect(result).toBe(true);
    });

    it("returns false when no matching user was found", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.setLoginChallenge("user-1", "hash", new Date());

        expect(result).toBe(false);
    });
});

describe("UserRepository.incrementLoginCodeAttempts", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when the attempt count was incremented", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.incrementLoginCodeAttempts("user-1");

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET login_code_attempts = login_code_attempts + 1"), ["user-1"]
        );
        expect(result).toBe(true);
    });
});

describe("UserRepository.clearLoginChallenge", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("clears the challenge's hash, expiry and attempt count", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.clearLoginChallenge("user-1");

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET login_code_hash = NULL, login_code_expires_at = NULL, login_code_attempts = 0"),
            ["user-1"]
        );
        expect(result).toBe(true);
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

describe("UserRepository.requestDeletion", () => {
    let repo;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
        client = {query: vi.fn()};
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("marks the account for deletion and revokes its refresh tokens in the same transaction", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1}); // UPDATE users
        client.query.mockResolvedValueOnce({rowCount: 2}); // UPDATE refresh_tokens

        const result = await repo.requestDeletion("user-1");

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("deleted_at = NOW()"), ["user-1"]);
        expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("UPDATE refresh_tokens"), ["user-1"]);
        expect(result).toBe(true);
    });

    it("returns false and does not touch refresh tokens when no matching user was found", async () => {
        client.query.mockResolvedValueOnce({rowCount: 0}); // UPDATE users

        const result = await repo.requestDeletion("user-1");

        expect(client.query).toHaveBeenCalledTimes(1);
        expect(result).toBe(false);
    });
});

describe("UserRepository.cancelDeletion", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns true when the deletion was cancelled", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.cancelDeletion("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("deleted_at = NULL"), ["user-1"]);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("email NOT LIKE 'deleted-%@anothapp.invalid'"), ["user-1"]);
        expect(result).toBe(true);
    });

    it("returns false when the account was already anonymized by the grace-period job", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.cancelDeletion("user-1");

        expect(result).toBe(false);
    });
});

describe("UserRepository.anonymizeEligibleAccounts", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns the number of accounts anonymized, passing the grace period in days and an unusable password hash", async () => {
        db.query.mockResolvedValue({rowCount: 3});

        const result = await repo.anonymizeEligibleAccounts(30);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE users"), [30, expect.any(String)]
        );
        expect(result).toBe(3);
    });

    it("skips accounts already anonymized", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        await repo.anonymizeEligibleAccounts(30);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("email NOT LIKE 'deleted-%@anothapp.invalid'"), [30, expect.any(String)]
        );
    });

    it("generates a password hash unrelated to any real password, different on every run", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.anonymizeEligibleAccounts(30);
        const [, firstHash] = db.query.mock.calls[0][1];
        await repo.anonymizeEligibleAccounts(30);
        const [, secondHash] = db.query.mock.calls[1][1];

        expect(firstHash).not.toBe(secondHash);
    });
});
