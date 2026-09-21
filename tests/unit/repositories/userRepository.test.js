import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import UserRepository from "../../../repositories/userRepository.js";
import ServiceError from "../../../helpers/serviceError.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

const validUserRow = {id: "user-1", picture: null, username: "bob", last_export: null, created_at: "2024-01-01"};

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

describe("UserRepository.getUserWithAuthById", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
    });

    it("returns the business and auth fields merged from a single joined row", async () => {
        db.query.mockResolvedValue({
            rowCount: 1,
            rows: [{
                ...validUserRow, user_id: "user-1", email: "a@b.com", password_hash: "hash",
                email_verified: true, pending_email: null,
            }],
        });

        const result = await repo.getUserWithAuthById("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("JOIN users_auth"), ["user-1"]);
        expect(result).toMatchObject({id: "user-1", username: "bob", email: "a@b.com", password: "hash", emailVerified: true});
    });

    it("returns null when the account (or its auth row) doesn't exist", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getUserWithAuthById("unknown");

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

describe("UserRepository.createUser", () => {
    let repo;
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
        client = {query: vi.fn()};
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("inserts the business row and the auth row in the same transaction, and returns the new id", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1, rows: [{id: "user-1"}]}); // INSERT INTO users
        client.query.mockResolvedValueOnce({rowCount: 1}); // INSERT INTO users_auth

        const result = await repo.createUser("a@b.com", "hash", "bob");

        expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining("INSERT INTO users"), ["bob"]);
        expect(client.query).toHaveBeenNthCalledWith(
            2, expect.stringContaining("INSERT INTO users_auth"), ["user-1", "a@b.com", "hash"]
        );
        expect(result).toBe("user-1");
    });

    it("returns null and never touches users_auth when the business row wasn't inserted", async () => {
        client.query.mockResolvedValueOnce({rowCount: 0, rows: []});

        const result = await repo.createUser("a@b.com", "hash", "bob");

        expect(client.query).toHaveBeenCalledTimes(1);
        expect(result).toBeNull();
    });

    it("returns null when the auth row insert fails, rolling back the business row via the shared transaction", async () => {
        client.query.mockResolvedValueOnce({rowCount: 1, rows: [{id: "user-1"}]});
        client.query.mockResolvedValueOnce({rowCount: 0});

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

    it("rejects auth fields - those belong to UserAuthRepository.updateField now", async () => {
        await expect(repo.updateField("user-1", "email_verified", true)).rejects.toBeInstanceOf(ServiceError);
        await expect(repo.updateField("user-1", "password_hash", "hash")).rejects.toBeInstanceOf(ServiceError);
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
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM users_auth"), ["user-1"]);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("email NOT LIKE '%@anothapp.invalid'"), ["user-1"]);
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
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserRepository();
        client = {query: vi.fn()};
        db.transaction.mockImplementation(async (callback) => callback(client));
    });

    it("anonymizes both the business and auth rows for every eligible account, in one transaction", async () => {
        client.query.mockResolvedValueOnce({rowCount: 2, rows: [{id: "user-1"}, {id: "user-2"}]}); // SELECT eligible
        client.query.mockResolvedValueOnce({rowCount: 2}); // UPDATE users
        client.query.mockResolvedValueOnce({rowCount: 2}); // UPDATE users_auth

        const result = await repo.anonymizeEligibleAccounts(30);

        expect(client.query).toHaveBeenNthCalledWith(
            1, expect.stringContaining("email NOT LIKE '%@anothapp.invalid'"), [30]
        );
        expect(client.query).toHaveBeenNthCalledWith(
            2, expect.stringContaining("UPDATE users"), [["user-1", "user-2"]]
        );
        expect(client.query).toHaveBeenNthCalledWith(
            3, expect.stringContaining("UPDATE users_auth"), [["user-1", "user-2"], expect.any(String)]
        );
        expect(result).toBe(2);
    });

    it("skips the update statements entirely when no account is eligible", async () => {
        client.query.mockResolvedValueOnce({rowCount: 0, rows: []});

        const result = await repo.anonymizeEligibleAccounts(30);

        expect(client.query).toHaveBeenCalledTimes(1);
        expect(result).toBe(0);
    });

    it("generates a password hash unrelated to any real password, different on every run", async () => {
        client.query.mockResolvedValue({rowCount: 1, rows: [{id: "user-1"}]});

        await repo.anonymizeEligibleAccounts(30);
        const firstHash = client.query.mock.calls[2][1][1];

        await repo.anonymizeEligibleAccounts(30);
        const secondHash = client.query.mock.calls[5][1][1];

        expect(firstHash).not.toBe(secondHash);
    });
});
