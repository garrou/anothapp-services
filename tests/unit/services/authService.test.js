import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import AuthService from "../../../services/authService.js";
import SecurityHelper from "../../../helpers/security.js";
import { DUPLICATE_ERROR_CODE } from "../../../constants/errors.js";

const userRepoMocks = vi.hoisted(() => ({
    getUserWithAuthById: vi.fn(),
    createUser: vi.fn(),
    cancelDeletion: vi.fn(),
}));
const userAuthRepoMocks = vi.hoisted(() => ({
    getByUserId: vi.fn(),
    getByEmail: vi.fn(),
    findForLogin: vi.fn(),
    updateField: vi.fn(),
    confirmPendingEmail: vi.fn(),
}));
const loginChallengeRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    getMostRecentByUserId: vi.fn(),
    incrementAttempts: vi.fn().mockResolvedValue(true),
    confirm: vi.fn(),
}));
const refreshRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    find: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
}));
const mailerServiceMocks = vi.hoisted(() => ({
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendLoginCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../../repositories/userAuthRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userAuthRepoMocks; }),
}));
vi.mock("../../../repositories/loginChallengeRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return loginChallengeRepoMocks; }),
}));
vi.mock("../../../repositories/refreshTokenRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return refreshRepoMocks; }),
}));
vi.mock("../../../services/mailerService.js", () => ({
    default: vi.fn().mockImplementation(function () { return mailerServiceMocks; }),
}));

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
});

describe("AuthService.login", () => {
    let authService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
    });

    it("rejects when the user does not exist, without revealing the account's absence", async () => {
        userAuthRepoMocks.findForLogin.mockResolvedValue(null);
        const compareSpy = vi.spyOn(SecurityHelper, "comparePassword");

        // app-facing error message stays in French, matching authService.js
        await expect(authService.login("unknown@test.fr", "wrongpass")).rejects.toThrow(
            "Identifiant ou mot de passe incorrect"
        );
        // same code path as a wrong password: we still compare against a dummy
        // hash, so the account's existence can't leak through timing
        expect(compareSpy).toHaveBeenCalled();
    });

    it("rejects when the password is incorrect", async () => {
        userAuthRepoMocks.findForLogin.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: await SecurityHelper.createHash("goodpassword"),
        });

        await expect(authService.login("adrien@test.fr", "wrongpassword")).rejects.toThrow(
            "Identifiant ou mot de passe incorrect"
        );
    });

    it("sends a login code and returns a pending-approval response when credentials are valid", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        userAuthRepoMocks.findForLogin.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: hash,
        });
        loginChallengeRepoMocks.create.mockResolvedValue("challenge-1");

        const result = await authService.login("adrien@test.fr", "goodpassword");

        expect(result.pendingApproval).toBe(true);
        expect(result.approvalToken).toBeDefined();
        expect(mailerServiceMocks.sendLoginCodeEmail).toHaveBeenCalledWith(
            "adrien@test.fr", expect.stringMatching(/^\d{6}$/)
        );
        // the code is checked against a stored hash, never baked into the approval token itself
        expect(loginChallengeRepoMocks.create).toHaveBeenCalledWith("1", expect.any(String), expect.any(Date));
        // the approval token's jti ties it to this specific challenge
        const payload = SecurityHelper.verifyJwt(result.approvalToken, SecurityHelper.loginApprovalSecret());
        expect(payload.jti).toBe("challenge-1");
        expect(refreshRepoMocks.create).not.toHaveBeenCalled();
    });

    it("returns a pending-deletion response instead of a login code when the account is scheduled for deletion, still within its grace period", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        userAuthRepoMocks.findForLogin.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: hash,
            deletedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const result = await authService.login("adrien@test.fr", "goodpassword");

        expect(result.pendingDeletion).toBe(true);
        expect(result.cancellationToken).toBeDefined();
        expect(result.pendingApproval).toBeUndefined();
        expect(mailerServiceMocks.sendLoginCodeEmail).not.toHaveBeenCalled();
        expect(loginChallengeRepoMocks.create).not.toHaveBeenCalled();
    });

    it("rejects the login without issuing a cancellation token once the grace period has elapsed", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        userAuthRepoMocks.findForLogin.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: hash,
            deletedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
        });

        await expect(authService.login("adrien@test.fr", "goodpassword")).rejects.toThrow(
            "Identifiant ou mot de passe incorrect"
        );
    });
});

describe("AuthService.confirmLogin", () => {
    let authService;
    const FUTURE = new Date(Date.now() + 10 * 60 * 1000);
    const PAST = new Date(Date.now() - 60 * 1000);
    const CHALLENGE_ID = "challenge-1";

    const activeChallenge = (overrides = {}) => ({
        id: CHALLENGE_ID,
        userId: "1",
        codeHash: SecurityHelper.hashLoginCode("123456"),
        expiresAt: FUTURE,
        attempts: 0,
        confirmedAt: null,
        ...overrides,
    });
    const approvalTokenFor = (challengeId = CHALLENGE_ID) =>
        SecurityHelper.signJwt("1", SecurityHelper.loginApprovalSecret(), "10m", { jti: challengeId });

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue(activeChallenge());
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "1", username: "adrien", email: "adrien@test.fr", emailVerified: true,
        });
    });

    it("rejects a token that wasn't signed with the login-approval secret", async () => {
        const approvalToken = SecurityHelper.signJwt("1", "wrong-secret");

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toThrow("Session invalide");
        expect(loginChallengeRepoMocks.getMostRecentByUserId).not.toHaveBeenCalled();
    });

    it("opens a session when the code matches an active challenge, and consumes it atomically so it can't be replayed", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.confirm.mockResolvedValue(true);
        refreshRepoMocks.create.mockResolvedValue(true);

        const result = await authService.confirmLogin(approvalToken, "123456");

        expect(result.token).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.user).toBeDefined();
        expect(loginChallengeRepoMocks.confirm).toHaveBeenCalledWith(
            "1", CHALLENGE_ID, SecurityHelper.hashLoginCode("123456")
        );
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("marks the email as verified when it wasn't already, since typing back the code proves ownership of the address", async () => {
        const approvalToken = approvalTokenFor();
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "1", email: "adrien@test.fr", emailVerified: false,
        });
        loginChallengeRepoMocks.confirm.mockResolvedValue(true);
        userAuthRepoMocks.updateField.mockResolvedValue(true);
        refreshRepoMocks.create.mockResolvedValue(true);

        await authService.confirmLogin(approvalToken, "123456");

        expect(userAuthRepoMocks.updateField).toHaveBeenCalledWith("1", "email_verified", true);
    });

    it("throws when marking the email as verified fails in the database", async () => {
        const approvalToken = approvalTokenFor();
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "1", email: "adrien@test.fr", emailVerified: false,
        });
        loginChallengeRepoMocks.confirm.mockResolvedValue(true);
        userAuthRepoMocks.updateField.mockResolvedValue(false);

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toThrow(
            "Impossible de confirmer cet email"
        );
    });

    it("rejects when the account behind the token no longer exists", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.confirm.mockResolvedValue(true);
        userRepoMocks.getUserWithAuthById.mockResolvedValue(null);

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toMatchObject({ status: 401 });
    });

    it("throws a 500 error when creating the refresh token fails in the database", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.confirm.mockResolvedValue(true);
        refreshRepoMocks.create.mockResolvedValue(false);

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toThrow(
            "Erreur durant l'authentification"
        );
    });

    it("rejects a wrong code and counts it as a failed attempt, without consuming the challenge", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.confirm.mockResolvedValue(false);

        await expect(authService.confirmLogin(approvalToken, "000000")).rejects.toMatchObject({
            status: 401, message: "Code invalide",
        });
        expect(loginChallengeRepoMocks.incrementAttempts).toHaveBeenCalledWith("1", CHALLENGE_ID);
        expect(refreshRepoMocks.create).not.toHaveBeenCalled();
    });

    it("rejects once the challenge has expired, even with the correct code, without writing a failed attempt", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue(activeChallenge({ expiresAt: PAST }));

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toMatchObject({
            status: 401, message: "Code expiré, veuillez vous reconnecter",
        });
        expect(loginChallengeRepoMocks.confirm).not.toHaveBeenCalled();
        expect(loginChallengeRepoMocks.incrementAttempts).not.toHaveBeenCalled();
    });

    it("rejects when there is no active challenge (never issued)", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue(null);

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toMatchObject({ status: 401 });
    });

    it("rejects when the active challenge was already confirmed - only the most recent row is ever checked, older ones are inert regardless of their own expiry", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue(activeChallenge({ confirmedAt: new Date() }));

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toMatchObject({ status: 401 });
        expect(loginChallengeRepoMocks.confirm).not.toHaveBeenCalled();
    });

    it("rejects once the max attempts have been used up, even with the correct code - the account must log in again for a new one", async () => {
        const approvalToken = approvalTokenFor();
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue(activeChallenge({ attempts: 5 }));

        await expect(authService.confirmLogin(approvalToken, "123456")).rejects.toMatchObject({
            status: 401, message: "Code expiré, veuillez vous reconnecter",
        });
        expect(refreshRepoMocks.create).not.toHaveBeenCalled();
    });

    it("rejects an approval token whose challenge no longer matches the account's active one, e.g. from a login() call that's since been superseded", async () => {
        const staleToken = approvalTokenFor("old-challenge");
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue(activeChallenge({ id: "new-challenge" }));

        await expect(authService.confirmLogin(staleToken, "123456")).rejects.toMatchObject({
            status: 401, message: "Code expiré, veuillez vous reconnecter",
        });
        expect(loginChallengeRepoMocks.confirm).not.toHaveBeenCalled();
        expect(loginChallengeRepoMocks.incrementAttempts).not.toHaveBeenCalled();
    });

    it("rejects login #1's token no matter which code it's paired with, once login #2 has superseded it", async () => {
        // login #1: challenge A / code 111111 - then the same account calls login() again before
        // confirming, which overwrites the active challenge with B / code 222222
        const tokenA = approvalTokenFor("challenge-A");
        const currentChallenge = activeChallenge({
            id: "challenge-B", codeHash: SecurityHelper.hashLoginCode("222222"),
        });
        loginChallengeRepoMocks.getMostRecentByUserId.mockResolvedValue(currentChallenge);

        // token A + its own (now stale) code
        await expect(authService.confirmLogin(tokenA, "111111")).rejects.toMatchObject({ status: 401 });
        // token A + challenge B's actual current code - still rejected: the token's jti is what's
        // checked, not just whether the submitted code happens to be right
        await expect(authService.confirmLogin(tokenA, "222222")).rejects.toMatchObject({ status: 401 });
        expect(loginChallengeRepoMocks.confirm).not.toHaveBeenCalled();

        // only token B (the one actually issued for the active challenge) can confirm it
        const tokenB = approvalTokenFor("challenge-B");
        loginChallengeRepoMocks.confirm.mockResolvedValueOnce(true);
        refreshRepoMocks.create.mockResolvedValue(true);
        await expect(authService.confirmLogin(tokenB, "222222")).resolves.toBeDefined();
    });

    it("only lets one of two concurrent confirmLogin calls (same token and code) actually open a session", async () => {
        const approvalToken = approvalTokenFor();
        refreshRepoMocks.create.mockResolvedValue(true);
        // simulates the atomic UPDATE in LoginChallengeRepository.confirm: only the request that
        // reaches the database first still finds a matching row to update
        loginChallengeRepoMocks.confirm
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);

        const [a, b] = await Promise.allSettled([
            authService.confirmLogin(approvalToken, "123456"),
            authService.confirmLogin(approvalToken, "123456"),
        ]);

        const fulfilled = [a, b].filter((r) => r.status === "fulfilled");
        const rejected = [a, b].filter((r) => r.status === "rejected");
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toMatchObject({ status: 401, message: "Code invalide" });
    });
});

describe("AuthService.cancelDeletion", () => {
    let authService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
    });

    it("rejects a token that wasn't signed with the deletion-cancellation secret", async () => {
        const token = SecurityHelper.signJwt("1", "wrong-secret");

        await expect(authService.cancelDeletion(token)).rejects.toThrow("Session invalide");
        expect(userRepoMocks.cancelDeletion).not.toHaveBeenCalled();
    });

    it("cancels the deletion and opens a real session", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.deletionCancellationSecret());
        userRepoMocks.cancelDeletion.mockResolvedValue(true);
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "1", username: "adrien", email: "adrien@test.fr", emailVerified: true,
        });
        refreshRepoMocks.create.mockResolvedValue(true);

        const result = await authService.cancelDeletion(token);

        expect(userRepoMocks.cancelDeletion).toHaveBeenCalledWith("1");
        expect(result.token).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.pendingDeletion).toBeUndefined();
    });

    it("throws a 500 error when cancelling the deletion fails in the database", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.deletionCancellationSecret());
        userRepoMocks.cancelDeletion.mockResolvedValue(false);

        await expect(authService.cancelDeletion(token)).rejects.toThrow(
            "Impossible d'annuler la suppression du compte"
        );
    });
});

describe("AuthService.register", () => {
    let authService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
    });

    it("rejects an invalid email before hitting the database", async () => {
        await expect(
            authService.register("not-an-email", "adrien", "Azerty123", "Azerty123")
        ).rejects.toThrow("Email incorrect");
        expect(userRepoMocks.createUser).not.toHaveBeenCalled();
    });

    it("rejects when the passwords don't match", async () => {
        await expect(
            authService.register("adrien@test.fr", "adrien", "Azerty123", "Azerty124")
        ).rejects.toThrow();
    });

    it("converts a unique constraint violation (23505) into an explicit 409 error", async () => {
        userRepoMocks.createUser.mockRejectedValue({ code: DUPLICATE_ERROR_CODE });

        await expect(
            authService.register("adrien@test.fr", "adrien", "Azerty123", "Azerty123")
        ).rejects.toThrow("Un compte est déjà associé à ces informations");
    });

    it("creates the account when everything is valid, without sending any email - confirmation now happens at first login", async () => {
        userRepoMocks.createUser.mockResolvedValue("1");

        await expect(
            authService.register("adrien@test.fr", "adrien", "Azerty123", "Azerty123")
        ).resolves.toBeUndefined();
        expect(userRepoMocks.createUser).toHaveBeenCalledWith(
            "adrien@test.fr",
            expect.any(String),
            "adrien"
        );
        expect(mailerServiceMocks.sendVerificationEmail).not.toHaveBeenCalled();
        expect(mailerServiceMocks.sendLoginCodeEmail).not.toHaveBeenCalled();
    });
});

describe("AuthService.verifyEmail", () => {
    let authService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "adrien@test.fr", pendingEmail: null });
    });

    it("rejects a token that wasn't signed with the email-verification secret", async () => {
        const token = SecurityHelper.signJwt("1", "wrong-secret");

        await expect(authService.verifyEmail(token)).rejects.toThrow("Session invalide");
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("marks the email as verified from a valid token", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.emailVerificationSecret());
        userAuthRepoMocks.updateField.mockResolvedValue(true);

        await authService.verifyEmail(token);

        expect(userAuthRepoMocks.updateField).toHaveBeenCalledWith("1", "email_verified", true);
    });

    it("throws when the update fails in the database", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.emailVerificationSecret());
        userAuthRepoMocks.updateField.mockResolvedValue(false);

        await expect(authService.verifyEmail(token)).rejects.toThrow("Impossible de confirmer cet email");
    });

    it("confirms a pending email change instead of touching email_verified, when the account has one", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.emailVerificationSecret());
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "adrien@test.fr", pendingEmail: "new@test.fr" });
        userAuthRepoMocks.confirmPendingEmail.mockResolvedValue(true);

        await authService.verifyEmail(token);

        expect(userAuthRepoMocks.confirmPendingEmail).toHaveBeenCalledWith("1");
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("throws when confirming a pending email fails in the database", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.emailVerificationSecret());
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "adrien@test.fr", pendingEmail: "new@test.fr" });
        userAuthRepoMocks.confirmPendingEmail.mockResolvedValue(false);

        await expect(authService.verifyEmail(token)).rejects.toThrow("Impossible de confirmer cet email");
    });

    it("surfaces a 409 when the pending email was taken by someone else in the meantime", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.emailVerificationSecret());
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "adrien@test.fr", pendingEmail: "new@test.fr" });
        userAuthRepoMocks.confirmPendingEmail.mockRejectedValue({ code: DUPLICATE_ERROR_CODE });

        await expect(authService.verifyEmail(token)).rejects.toMatchObject({ status: 409 });
    });
});

describe("AuthService.forgotPassword", () => {
    let authService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
    });

    it("resolves without sending anything when no account matches the email (no enumeration)", async () => {
        userAuthRepoMocks.getByEmail.mockResolvedValue(null);

        await expect(authService.forgotPassword("unknown@test.fr")).resolves.toBeUndefined();
        expect(mailerServiceMocks.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("sends a password-reset email otherwise", async () => {
        userAuthRepoMocks.getByEmail.mockResolvedValue({ userId: "1", password: "hash" });

        await authService.forgotPassword("adrien@test.fr");

        expect(mailerServiceMocks.sendPasswordResetEmail).toHaveBeenCalledWith(
            "adrien@test.fr", expect.stringContaining("/reset-password/")
        );
    });

    it("does not wait on or fail because the email couldn't be sent (fire-and-forget)", async () => {
        userAuthRepoMocks.getByEmail.mockResolvedValue({ userId: "1", password: "hash" });
        mailerServiceMocks.sendPasswordResetEmail.mockRejectedValueOnce(new Error("SMTP down"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(authService.forgotPassword("adrien@test.fr")).resolves.toBeUndefined();
        await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());
        consoleSpy.mockRestore();
    });
});

describe("AuthService.resetPassword", () => {
    let authService;
    const OLD_HASH = "old-password-hash";

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
        userAuthRepoMocks.getByUserId.mockResolvedValue({ userId: "1", password: OLD_HASH });
    });

    it("rejects a token that wasn't signed with a secret derived from the account's current password hash", async () => {
        const token = SecurityHelper.signJwt("1", "wrong-secret");

        await expect(authService.resetPassword(token, "Azerty123", "Azerty123")).rejects.toThrow(
            "Session invalide"
        );
    });

    it("rejects a token whose account no longer exists", async () => {
        userAuthRepoMocks.getByUserId.mockResolvedValue(null);
        const token = SecurityHelper.signJwt("1", SecurityHelper.passwordResetSecret(OLD_HASH));

        await expect(authService.resetPassword(token, "Azerty123", "Azerty123")).rejects.toThrow(
            "Session invalide"
        );
    });

    it("rejects mismatched passwords", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.passwordResetSecret(OLD_HASH));

        await expect(authService.resetPassword(token, "Azerty123", "Azerty124")).rejects.toThrow();
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("updates the password and revokes every existing session", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.passwordResetSecret(OLD_HASH));
        userAuthRepoMocks.updateField.mockResolvedValue(true);

        await authService.resetPassword(token, "Azerty123", "Azerty123");

        expect(userAuthRepoMocks.updateField).toHaveBeenCalledWith("1", "password_hash", expect.any(String));
        expect(refreshRepoMocks.revokeAllForUser).toHaveBeenCalledWith("1");
    });

    it("throws when the update fails in the database", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.passwordResetSecret(OLD_HASH));
        userAuthRepoMocks.updateField.mockResolvedValue(false);

        await expect(authService.resetPassword(token, "Azerty123", "Azerty123")).rejects.toThrow(
            "Impossible de réinitialiser le mot de passe"
        );
        expect(refreshRepoMocks.revokeAllForUser).not.toHaveBeenCalled();
    });

    it("rejects a reused token once the password has already been changed (single-use via the password-bound secret)", async () => {
        const token = SecurityHelper.signJwt("1", SecurityHelper.passwordResetSecret(OLD_HASH));
        // the account's password hash has since changed (e.g. the token was already used once) -
        // getByUserId now returns the new hash, so the token's signature no longer matches
        userAuthRepoMocks.getByUserId.mockResolvedValue({ userId: "1", password: "new-password-hash" });

        await expect(authService.resetPassword(token, "Azerty123", "Azerty123")).rejects.toThrow(
            "Session invalide"
        );
    });
});

describe("AuthService.refreshToken", () => {
    let authService;

    beforeEach(() => {
        vi.clearAllMocks();
        authService = new AuthService();
    });

    it("rejects an unknown or expired refresh token", async () => {
        refreshRepoMocks.find.mockResolvedValue(null);

        await expect(authService.refreshToken("unknown-token")).rejects.toThrow(
            "Jeton de renouvellement de session invalide"
        );
    });

    it("revokes the old token and issues a new one (rotation)", async () => {
        refreshRepoMocks.find.mockResolvedValue({ id: "rt-1", userId: "1" });
        refreshRepoMocks.revoke.mockResolvedValue(true);
        refreshRepoMocks.create.mockResolvedValue(true);

        const result = await authService.refreshToken("valid-token");

        expect(refreshRepoMocks.revoke).toHaveBeenCalledWith("rt-1");
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
    });
});
