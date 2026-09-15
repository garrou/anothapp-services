import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../config/db.js";
import RefreshTokenRepository from "./refreshTokenRepository.js";

vi.mock("../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("RefreshTokenRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new RefreshTokenRepository();
    });

    it("returns true when the token was inserted", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.create("user-1", "hash", new Date("2024-01-01"));

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO refresh_tokens"), ["user-1", "hash", new Date("2024-01-01")]);
        expect(result).toBe(true);
    });
});

describe("RefreshTokenRepository.find", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new RefreshTokenRepository();
    });

    it("maps the row to a RefreshToken when a valid token is found", async () => {
        db.query.mockResolvedValue({
            rowCount: 1,
            rows: [{id: 1, user_id: "user-1", token_hash: "hash", expires_at: "2024-01-01", revoked_at: null, created_at: "2023-12-01"}],
        });

        const result = await repo.find("hash");

        expect(result).toEqual({
            id: 1, userId: "user-1", tokenHash: "hash", expiresAt: "2024-01-01", revokedAt: null, createdAt: "2023-12-01",
        });
    });

    it("returns null when no valid token matches", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.find("unknown");

        expect(result).toBeNull();
    });
});

describe("RefreshTokenRepository.revoke", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new RefreshTokenRepository();
    });

    it("returns true when a token was revoked", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.revoke("token-1");

        expect(result).toBe(true);
    });

    it("returns false when no matching token existed", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.revoke("unknown");

        expect(result).toBe(false);
    });
});

describe("RefreshTokenRepository.deleteRevokedOlderThanDays", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new RefreshTokenRepository();
    });

    it("returns the number of deleted rows", async () => {
        db.query.mockResolvedValue({rowCount: 5});

        const result = await repo.deleteRevokedOlderThanDays(30);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM refresh_tokens"), [30]);
        expect(result).toBe(5);
    });
});
