import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import UserAuthRepository from "../../../repositories/userAuthRepository.js";
import ServiceError from "../../../helpers/serviceError.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

const validAuthRow = {
    user_id: "user-1", email: "a@b.com", password_hash: "hash", email_verified: true, pending_email: null,
};

describe("UserAuthRepository.getByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserAuthRepository();
    });

    it("returns a UserAuth when found", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [validAuthRow]});

        const result = await repo.getByUserId("user-1");

        expect(result.email).toBe("a@b.com");
        expect(result.password).toBe("hash");
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getByUserId("unknown");

        expect(result).toBeNull();
    });
});

describe("UserAuthRepository.getByEmail", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserAuthRepository();
    });

    it("matches case-insensitively", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [validAuthRow]});

        await repo.getByEmail("A@B.COM");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPPER(email) = UPPER($1)"), ["A@B.COM"]);
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getByEmail("unknown@b.com");

        expect(result).toBeNull();
    });
});

describe("UserAuthRepository.findForLogin", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserAuthRepository();
    });

    it("matches both username and email case-insensitively, joining back to users", async () => {
        db.query.mockResolvedValue({
            rowCount: 1, rows: [{id: "user-1", deleted_at: null, email: "a@b.com", password_hash: "hash"}],
        });

        const result = await repo.findForLogin("bob");

        const [query, params] = db.query.mock.calls[0];
        expect(query).toContain("UPPER(u.username) = UPPER($1)");
        expect(query).toContain("UPPER(ua.email) = UPPER($1)");
        expect(params).toEqual(["bob"]);
        expect(result).toEqual({id: "user-1", deletedAt: null, email: "a@b.com", password: "hash"});
    });

    it("returns null when not found", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.findForLogin("unknown");

        expect(result).toBeNull();
    });
});

describe("UserAuthRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserAuthRepository();
    });

    it("inserts the auth row and returns true", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.create("user-1", "a@b.com", "hash");

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO users_auth"), ["user-1", "a@b.com", "hash"]
        );
        expect(result).toBe(true);
    });

    it("uses the provided client instead of the default db when given (e.g. inside a transaction)", async () => {
        const client = {query: vi.fn().mockResolvedValue({rowCount: 1})};

        await repo.create("user-1", "a@b.com", "hash", client);

        expect(client.query).toHaveBeenCalled();
        expect(db.query).not.toHaveBeenCalled();
    });
});

describe("UserAuthRepository.updateField", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserAuthRepository();
    });

    it("returns true when a valid field was updated", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.updateField("user-1", "email_verified", true);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users_auth"), [true, "user-1"]);
        expect(result).toBe(true);
    });

    it("throws a ServiceError for an invalid field", async () => {
        await expect(repo.updateField("user-1", "username", "hacker")).rejects.toBeInstanceOf(ServiceError);
        expect(db.query).not.toHaveBeenCalled();
    });
});

describe("UserAuthRepository.confirmPendingEmail", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new UserAuthRepository();
    });

    it("returns true when a pending email was moved into email", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.confirmPendingEmail("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("SET email = pending_email"), ["user-1"]);
        expect(result).toBe(true);
    });

    it("returns false when the account has no pending email", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.confirmPendingEmail("user-1");

        expect(result).toBe(false);
    });
});
