import {describe, it, expect, vi, beforeEach} from "vitest";
import db from "../../../config/db.js";
import LoginChallengeRepository from "../../../repositories/loginChallengeRepository.js";

vi.mock("../../../config/db.js", () => ({
    default: {query: vi.fn(), transaction: vi.fn()},
}));

describe("LoginChallengeRepository.create", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new LoginChallengeRepository();
    });

    it("inserts a new challenge and returns its id", async () => {
        db.query.mockResolvedValue({rows: [{id: "challenge-1"}]});
        const expiresAt = new Date();

        const result = await repo.create("user-1", "hash", expiresAt);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO login_challenges"), ["user-1", "hash", expiresAt]
        );
        expect(result).toBe("challenge-1");
    });
});

describe("LoginChallengeRepository.getMostRecentByUserId", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new LoginChallengeRepository();
    });

    it("returns the most recently created challenge for the account", async () => {
        db.query.mockResolvedValue({rowCount: 1, rows: [{id: "challenge-2", user_id: "user-1", code_hash: "hash", expires_at: "2024-01-01", attempts: 0, confirmed_at: null, created_at: "2024-01-01"}]});

        const result = await repo.getMostRecentByUserId("user-1");

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY created_at DESC"), ["user-1"]);
        expect(result.id).toBe("challenge-2");
    });

    it("returns null when the account has never logged in", async () => {
        db.query.mockResolvedValue({rowCount: 0, rows: []});

        const result = await repo.getMostRecentByUserId("user-1");

        expect(result).toBeNull();
    });
});

describe("LoginChallengeRepository.incrementAttempts", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new LoginChallengeRepository();
    });

    it("returns true when the attempt count was incremented", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.incrementAttempts("user-1", "challenge-1");

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET attempts = attempts + 1"), ["challenge-1", "user-1", 5]
        );
        expect(result).toBe(true);
    });

    it("returns false when the challenge is already maxed out, confirmed, or gone - bounded by the WHERE clause, not a separate read", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.incrementAttempts("user-1", "challenge-1");

        expect(result).toBe(false);
    });
});

describe("LoginChallengeRepository.confirm", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new LoginChallengeRepository();
    });

    it("marks the challenge confirmed and returns true when the code, id, expiry and attempt count all match", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        const result = await repo.confirm("user-1", "challenge-1", "hash");

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("SET confirmed_at = NOW()"), ["challenge-1", "user-1", "hash", 5]
        );
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("confirmed_at IS NULL"), expect.any(Array));
        expect(result).toBe(true);
    });

    it("returns false without confirming anything when the code doesn't match - the check and the update are the same atomic statement", async () => {
        db.query.mockResolvedValue({rowCount: 0});

        const result = await repo.confirm("user-1", "challenge-1", "wrong-hash");

        expect(result).toBe(false);
    });

    it("requires the challenge to still be the most recent one in the same atomic statement, not just via an earlier read", async () => {
        db.query.mockResolvedValue({rowCount: 1});

        await repo.confirm("user-1", "challenge-1", "hash");

        const [query] = db.query.mock.calls[0];
        expect(query).toContain("ORDER BY created_at DESC LIMIT 1");
        expect(query).toMatch(/id = \(\s*SELECT id FROM login_challenges WHERE user_id = \$2/);
    });
});

describe("LoginChallengeRepository.deleteOlderThanDays", () => {
    let repo;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new LoginChallengeRepository();
    });

    it("returns the number of challenges deleted", async () => {
        db.query.mockResolvedValue({rowCount: 12});

        const result = await repo.deleteOlderThanDays(7);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM login_challenges"), [7]);
        expect(result).toBe(12);
    });
});
