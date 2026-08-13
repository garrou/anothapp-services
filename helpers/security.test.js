import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import SecurityHelper from "./security.js";

const SECRET = "test-secret";

beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
});

describe("SecurityHelper.hashToken", () => {
    it("is deterministic: the same input always produces the same hash", () => {
        const a = SecurityHelper.hashToken("some-refresh-token");
        const b = SecurityHelper.hashToken("some-refresh-token");
        expect(a).toBe(b);
    });

    it("produces different hashes for different inputs", () => {
        const a = SecurityHelper.hashToken("token-a");
        const b = SecurityHelper.hashToken("token-b");
        expect(a).not.toBe(b);
    });
});

describe("SecurityHelper.generateRefreshToken", () => {
    it("returns a 128-character hex string (64 random bytes)", () => {
        const token = SecurityHelper.generateRefreshToken();
        expect(token).toMatch(/^[0-9a-f]{128}$/);
    });

    it("returns a different value on every call", () => {
        const a = SecurityHelper.generateRefreshToken();
        const b = SecurityHelper.generateRefreshToken();
        expect(a).not.toBe(b);
    });
});

describe("SecurityHelper.signJwt / verifyJwt", () => {
    it("round-trips: a signed token verifies back to the same userId", () => {
        const token = SecurityHelper.signJwt("user-1", SECRET);
        const payload = SecurityHelper.verifyJwt(token, SECRET);
        expect(payload.sub).toBe("user-1");
    });

    it("throws a 401 ServiceError with ERROR_TOKEN_EXPIRED on an expired token", () => {
        const expired = jwt.sign({ sub: "user-1" }, SECRET, { expiresIn: -1 });

        expect(() => SecurityHelper.verifyJwt(expired, SECRET)).toThrow("Session expirée");
        try {
            SecurityHelper.verifyJwt(expired, SECRET);
        } catch (e) {
            expect(e.status).toBe(401);
        }
    });

    it("throws a 401 ServiceError with ERROR_TOKEN_INVALID on a malformed token", () => {
        expect(() => SecurityHelper.verifyJwt("not-a-valid-jwt", SECRET)).toThrow("Session invalide");
    });

    it("throws a 401 ServiceError with ERROR_TOKEN_INVALID when the secret doesn't match", () => {
        const token = SecurityHelper.signJwt("user-1", SECRET);
        expect(() => SecurityHelper.verifyJwt(token, "wrong-secret")).toThrow("Session invalide");
    });
});

describe("SecurityHelper.extractBearerToken", () => {
    it("returns undefined when the header is missing", () => {
        expect(SecurityHelper.extractBearerToken(undefined)).toBeUndefined();
    });

    it("returns undefined for a non-Bearer scheme", () => {
        expect(SecurityHelper.extractBearerToken("Basic dXNlcjpwYXNz")).toBeUndefined();
    });

    it("extracts the token from a well-formed Bearer header", () => {
        expect(SecurityHelper.extractBearerToken("Bearer abc123")).toBe("abc123");
    });
});

describe("SecurityHelper.createHash / comparePassword", () => {
    it("round-trips: the original password matches its own hash", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        const same = await SecurityHelper.comparePassword("goodpassword", hash);
        expect(same).toBe(true);
    });

    it("rejects a different password against that hash", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        const same = await SecurityHelper.comparePassword("wrongpassword", hash);
        expect(same).toBe(false);
    });
});