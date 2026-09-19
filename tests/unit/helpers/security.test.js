import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import SecurityHelper from "../../../helpers/security.js";

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

    it("defaults to a 15 minute expiry", () => {
        const token = SecurityHelper.signJwt("user-1", SECRET);
        const decoded = jwt.decode(token);
        expect(decoded.exp - decoded.iat).toBe(15 * 60);
    });

    it("accepts a custom expiry, e.g. for a longer-lived email link", () => {
        const token = SecurityHelper.signJwt("user-1", SECRET, "1d");
        const decoded = jwt.decode(token);
        expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
    });
});

describe("SecurityHelper.deletionCancellationSecret", () => {
    it("is deterministic for the same JWT_SECRET", () => {
        expect(SecurityHelper.deletionCancellationSecret()).toBe(SecurityHelper.deletionCancellationSecret());
    });

    it("is different from the real JWT_SECRET, so a token signed with it never verifies against JWT_SECRET", () => {
        const cancellationToken = SecurityHelper.signJwt("user-1", SecurityHelper.deletionCancellationSecret());
        expect(() => SecurityHelper.verifyJwt(cancellationToken, SECRET)).toThrow("Session invalide");
    });

    it("changes when JWT_SECRET changes", () => {
        const first = SecurityHelper.deletionCancellationSecret();
        process.env.JWT_SECRET = "different-secret";
        const second = SecurityHelper.deletionCancellationSecret();
        process.env.JWT_SECRET = SECRET;
        expect(first).not.toBe(second);
    });
});

describe("SecurityHelper.emailVerificationSecret / passwordResetSecret", () => {
    const PASSWORD_HASH = "some-bcrypt-hash";

    it("are deterministic, distinct from each other and from deletionCancellationSecret", () => {
        expect(SecurityHelper.emailVerificationSecret()).toBe(SecurityHelper.emailVerificationSecret());
        expect(SecurityHelper.passwordResetSecret(PASSWORD_HASH)).toBe(SecurityHelper.passwordResetSecret(PASSWORD_HASH));
        expect(SecurityHelper.emailVerificationSecret()).not.toBe(SecurityHelper.passwordResetSecret(PASSWORD_HASH));
        expect(SecurityHelper.emailVerificationSecret()).not.toBe(SecurityHelper.deletionCancellationSecret());
    });

    it("neither can verify a token meant for the real JWT_SECRET or for each other", () => {
        const verificationToken = SecurityHelper.signJwt("user-1", SecurityHelper.emailVerificationSecret());
        const resetToken = SecurityHelper.signJwt("user-1", SecurityHelper.passwordResetSecret(PASSWORD_HASH));

        expect(() => SecurityHelper.verifyJwt(verificationToken, SECRET)).toThrow("Session invalide");
        expect(() => SecurityHelper.verifyJwt(verificationToken, SecurityHelper.passwordResetSecret(PASSWORD_HASH))).toThrow("Session invalide");
        expect(() => SecurityHelper.verifyJwt(resetToken, SecurityHelper.emailVerificationSecret())).toThrow("Session invalide");
    });
});

describe("SecurityHelper.loginApprovalSecret", () => {
    it("is deterministic, and distinct from the other derived secrets", () => {
        expect(SecurityHelper.loginApprovalSecret()).toBe(SecurityHelper.loginApprovalSecret());
        expect(SecurityHelper.loginApprovalSecret()).not.toBe(SecurityHelper.deletionCancellationSecret());
        expect(SecurityHelper.loginApprovalSecret()).not.toBe(SecurityHelper.emailVerificationSecret());
    });
});

describe("SecurityHelper.generateLoginCode", () => {
    it("returns a zero-padded 6-digit string", () => {
        for (let i = 0; i < 20; i++) {
            expect(SecurityHelper.generateLoginCode()).toMatch(/^\d{6}$/);
        }
    });
});

describe("SecurityHelper.verifyLoginCode", () => {
    it("returns true when the code matches its stored hash", () => {
        const hash = SecurityHelper.hashToken("123456");
        expect(SecurityHelper.verifyLoginCode("123456", hash)).toBe(true);
    });

    it("returns false for a wrong code", () => {
        const hash = SecurityHelper.hashToken("123456");
        expect(SecurityHelper.verifyLoginCode("000000", hash)).toBe(false);
    });
});

describe("SecurityHelper.passwordResetSecret", () => {
    it("changes when the password hash changes, so a reset token can't be replayed after the password was already changed", () => {
        const first = SecurityHelper.passwordResetSecret("hash-a");
        const second = SecurityHelper.passwordResetSecret("hash-b");
        expect(first).not.toBe(second);
    });
});

describe("SecurityHelper.decodeJwt", () => {
    it("reads the payload without checking the signature", () => {
        const token = SecurityHelper.signJwt("user-1", "any-secret-at-all");
        expect(SecurityHelper.decodeJwt(token).sub).toBe("user-1");
    });

    it("returns null for a malformed token instead of throwing", () => {
        expect(SecurityHelper.decodeJwt("not-a-valid-jwt")).toBeNull();
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

describe("SecurityHelper.canonicalStringify", () => {
    it("is insensitive to key order", () => {
        const a = SecurityHelper.canonicalStringify({ a: 1, b: 2 });
        const b = SecurityHelper.canonicalStringify({ b: 2, a: 1 });
        expect(a).toBe(b);
    });

    it("sorts keys recursively, including inside arrays", () => {
        const result = SecurityHelper.canonicalStringify({ shows: [{ title: "X", id: 1 }] });
        expect(result).toBe('{"shows":[{"id":1,"title":"X"}]}');
    });

    it("drops undefined-valued object properties, like JSON.stringify does", () => {
        expect(SecurityHelper.canonicalStringify({ a: 1, b: undefined })).toBe('{"a":1}');
    });
});

describe("SecurityHelper.signExportData / verifyExportSignature", () => {
    it("is deterministic and insensitive to key order", () => {
        const a = SecurityHelper.signExportData({ shows: [], user: { id: "u1" } });
        const b = SecurityHelper.signExportData({ user: { id: "u1" }, shows: [] });
        expect(a).toBe(b);
    });

    it("changes when the content changes", () => {
        const a = SecurityHelper.signExportData({ shows: [] });
        const b = SecurityHelper.signExportData({ shows: [{ id: 1 }] });
        expect(a).not.toBe(b);
    });

    it("round-trips: a freshly signed export verifies", () => {
        const data = { shows: [{ id: 1, title: "Show" }] };
        const signature = SecurityHelper.signExportData(data);
        expect(SecurityHelper.verifyExportSignature({ ...data, signature })).toBe(true);
    });

    it("rejects a payload whose content was edited after signing", () => {
        const data = { shows: [{ id: 1, title: "Show" }] };
        const signature = SecurityHelper.signExportData(data);
        const tampered = { ...data, shows: [{ id: 1, title: "Tampered" }], signature };
        expect(SecurityHelper.verifyExportSignature(tampered)).toBe(false);
    });

    it("rejects a payload with no signature field", () => {
        expect(SecurityHelper.verifyExportSignature({ shows: [] })).toBe(false);
    });

    it("rejects a payload with a non-string signature", () => {
        expect(SecurityHelper.verifyExportSignature({ shows: [], signature: 12345 })).toBe(false);
    });

    it("rejects null/undefined payloads", () => {
        expect(SecurityHelper.verifyExportSignature(null)).toBe(false);
        expect(SecurityHelper.verifyExportSignature(undefined)).toBe(false);
    });

    it("survives a pretty-printed JSON round-trip (reordered whitespace, same content)", () => {
        const data = { shows: [{ id: 1, title: "Show" }], user: { episodeTrackingEnabled: true } };
        const signature = SecurityHelper.signExportData(data);
        const file = JSON.stringify({ ...data, signature }, null, 4);
        const reparsed = JSON.parse(file);
        expect(SecurityHelper.verifyExportSignature(reparsed)).toBe(true);
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