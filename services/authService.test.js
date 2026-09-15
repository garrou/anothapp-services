import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import AuthService from "./authService.js";
import SecurityHelper from "../helpers/security.js";
import { DUPLICATE_ERROR_CODE } from "../constants/errors.js";

const userRepoMocks = vi.hoisted(() => ({
    getUserByIdentifier: vi.fn(),
    createUser: vi.fn(),
    cancelDeletion: vi.fn(),
    getUserById: vi.fn(),
}));
const refreshRepoMocks = vi.hoisted(() => ({
    create: vi.fn(),
    find: vi.fn(),
    revoke: vi.fn(),
}));

vi.mock("../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../repositories/refreshTokenRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return refreshRepoMocks; }),
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
        userRepoMocks.getUserByIdentifier.mockResolvedValue(null);
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
        userRepoMocks.getUserByIdentifier.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: await SecurityHelper.createHash("goodpassword"),
        });

        await expect(authService.login("adrien@test.fr", "wrongpassword")).rejects.toThrow(
            "Identifiant ou mot de passe incorrect"
        );
    });

    it("returns a token and a refresh token when credentials are valid", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        userRepoMocks.getUserByIdentifier.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            username: "adrien",
            password: hash,
        });
        refreshRepoMocks.create.mockResolvedValue(true);

        const result = await authService.login("adrien@test.fr", "goodpassword");

        expect(result.token).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.user).toBeDefined();
    });

    it("throws a 500 error when creating the refresh token fails in the database", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        userRepoMocks.getUserByIdentifier.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: hash,
        });
        refreshRepoMocks.create.mockResolvedValue(false);

        await expect(authService.login("adrien@test.fr", "goodpassword")).rejects.toThrow(
            "Erreur durant l'authentification"
        );
    });

    it("returns a pending-deletion response instead of a session when the account is scheduled for deletion", async () => {
        const hash = await SecurityHelper.createHash("goodpassword");
        userRepoMocks.getUserByIdentifier.mockResolvedValue({
            id: "1",
            email: "adrien@test.fr",
            password: hash,
            deletedAt: "2024-01-01T00:00:00.000Z",
        });

        const result = await authService.login("adrien@test.fr", "goodpassword");

        expect(result.pendingDeletion).toBe(true);
        expect(result.cancellationToken).toBeDefined();
        expect(result.token).toBeUndefined();
        expect(refreshRepoMocks.create).not.toHaveBeenCalled();
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
        userRepoMocks.getUserById.mockResolvedValue({ id: "1", email: "adrien@test.fr", username: "adrien" });
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

    it("creates the account when everything is valid", async () => {
        userRepoMocks.createUser.mockResolvedValue(true);

        await expect(
            authService.register("adrien@test.fr", "adrien", "Azerty123", "Azerty123")
        ).resolves.toBeUndefined();
        expect(userRepoMocks.createUser).toHaveBeenCalledWith(
            "adrien@test.fr",
            expect.any(String),
            "adrien"
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