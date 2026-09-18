import { describe, it, expect, vi, beforeEach } from "vitest";
import UserService from "../../../services/userService.js";
import UserUpdate from "../../../models/userUpdate.js";
import SecurityHelper from "../../../helpers/security.js";
import { ERROR_BAD_PASSWORD } from "../../../constants/errors.js";

const userRepoMocks = vi.hoisted(() => ({
    updateField: vi.fn(),
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
    getUsersByUsername: vi.fn(),
    requestDeletion: vi.fn(),
}));
const episodeServiceMocks = vi.hoisted(() => ({
    backfillForUser: vi.fn(),
}));
const authServiceMocks = vi.hoisted(() => ({
    issueEmailVerification: vi.fn(),
}));
const refreshTokenRepoMocks = vi.hoisted(() => ({
    revokeAllForUser: vi.fn(),
}));

vi.mock("../../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../../repositories/refreshTokenRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return refreshTokenRepoMocks; }),
}));
vi.mock("../../../services/episodeService.js", () => ({
    default: vi.fn().mockImplementation(function () { return episodeServiceMocks; }),
}));
vi.mock("../../../services/authService.js", () => ({
    default: vi.fn().mockImplementation(function () { return authServiceMocks; }),
}));

describe("UserService.updateUser - episode tracking", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
    });

    it("enables the flag and triggers a backfill of the existing history", async () => {
        userRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser("user-1", new UserUpdate({ episodeTrackingEnabled: true }));

        expect(userRepoMocks.updateField).toHaveBeenCalledWith("user-1", "episode_tracking_enabled", true);
        expect(episodeServiceMocks.backfillForUser).toHaveBeenCalledWith("user-1");
        expect(message).toBe("Suivi des épisodes activé");
    });

    it("disables the flag without triggering a backfill", async () => {
        userRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser("user-1", new UserUpdate({ episodeTrackingEnabled: false }));

        expect(episodeServiceMocks.backfillForUser).not.toHaveBeenCalled();
        expect(message).toBe("Suivi des épisodes désactivé");
    });

    it("throws a 500 when the update fails in the database", async () => {
        userRepoMocks.updateField.mockResolvedValue(false);

        await expect(
            userService.updateUser("user-1", new UserUpdate({ episodeTrackingEnabled: true }))
        ).rejects.toThrow("Impossible de modifier le suivi des épisodes");
        expect(episodeServiceMocks.backfillForUser).not.toHaveBeenCalled();
    });

    it("enables the flag without a backfill when the caller passes skipBackfill, e.g. a data import", async () => {
        userRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser(
            "user-1", new UserUpdate({ episodeTrackingEnabled: true }), { skipBackfill: true }
        );

        expect(userRepoMocks.updateField).toHaveBeenCalledWith("user-1", "episode_tracking_enabled", true);
        expect(episodeServiceMocks.backfillForUser).not.toHaveBeenCalled();
        expect(message).toBe("Suivi des épisodes activé");
    });
});

describe("UserService.updateUser - email change", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
    });

    it("changes the email, clears the verification flag, revokes sessions, and sends a new verification email", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserById.mockResolvedValue({ id: "user-1", email: "old@test.fr", password: hash });
        userRepoMocks.getUserByEmail.mockResolvedValue(null);
        userRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser(
            "user-1", new UserUpdate({ email: "old@test.fr", newEmail: "new@test.fr", currentPassword: "GoodPassword1" })
        );

        expect(message).toBe("Email modifié");
        expect(userRepoMocks.updateField).toHaveBeenCalledWith("user-1", "email", "new@test.fr");
        expect(userRepoMocks.updateField).toHaveBeenCalledWith("user-1", "email_verified", false);
        expect(refreshTokenRepoMocks.revokeAllForUser).toHaveBeenCalledWith("user-1");
        expect(authServiceMocks.issueEmailVerification).toHaveBeenCalledWith("user-1", "new@test.fr");
    });

    it("rejects a missing or wrong current password, without touching anything", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserById.mockResolvedValue({ id: "user-1", email: "old@test.fr", password: hash });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ email: "old@test.fr", newEmail: "new@test.fr" })
        )).rejects.toMatchObject({ status: 400, message: ERROR_BAD_PASSWORD });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ email: "old@test.fr", newEmail: "new@test.fr", currentPassword: "WrongPassword" })
        )).rejects.toMatchObject({ status: 400, message: ERROR_BAD_PASSWORD });

        expect(userRepoMocks.updateField).not.toHaveBeenCalled();
        expect(refreshTokenRepoMocks.revokeAllForUser).not.toHaveBeenCalled();
        expect(authServiceMocks.issueEmailVerification).not.toHaveBeenCalled();
    });

    it("rejects when the new email is already taken, without touching the verification flag", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserById.mockResolvedValue({ id: "user-1", email: "old@test.fr", password: hash });
        userRepoMocks.getUserByEmail.mockResolvedValue({ id: "user-2" });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ email: "old@test.fr", newEmail: "taken@test.fr", currentPassword: "GoodPassword1" })
        )).rejects.toMatchObject({ status: 409 });
        expect(userRepoMocks.updateField).not.toHaveBeenCalled();
        expect(authServiceMocks.issueEmailVerification).not.toHaveBeenCalled();
    });

    it("does not fail the email change just because the verification email couldn't be sent", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserById.mockResolvedValue({ id: "user-1", email: "old@test.fr", password: hash });
        userRepoMocks.getUserByEmail.mockResolvedValue(null);
        userRepoMocks.updateField.mockResolvedValue(true);
        authServiceMocks.issueEmailVerification.mockRejectedValueOnce(new Error("SMTP down"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const message = await userService.updateUser(
            "user-1", new UserUpdate({ email: "old@test.fr", newEmail: "new@test.fr", currentPassword: "GoodPassword1" })
        );

        expect(message).toBe("Email modifié");
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

describe("UserService.getProfile", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
        userRepoMocks.getUserById.mockResolvedValue({
            id: "user-2", email: "user2@test.fr", username: "user2", picture: null, episodeTrackingEnabled: false,
        });
    });

    it("never includes the email when viewing another user's profile", async () => {
        const profile = await userService.getProfile("user-2", false);

        expect(profile.email).toBeUndefined();
        expect(profile.username).toBe("user2");
    });

    it("includes the email only for the profile owner", async () => {
        const profile = await userService.getProfile("user-2", true);

        expect(profile.email).toBe("user2@test.fr");
    });

    it("includes createdAt for the profile owner", async () => {
        userRepoMocks.getUserById.mockResolvedValue({
            id: "user-2", email: "user2@test.fr", username: "user2", picture: null,
            episodeTrackingEnabled: false, createdAt: "2020-05-01T00:00:00.000Z",
        });

        const profile = await userService.getProfile("user-2", true);

        expect(profile.createdAt).toBe("2020-05-01T00:00:00.000Z");
    });

    it("never includes createdAt when viewing another user's profile (GET /users/:id has no friendship check)", async () => {
        userRepoMocks.getUserById.mockResolvedValue({
            id: "user-2", email: "user2@test.fr", username: "user2", picture: null,
            episodeTrackingEnabled: false, createdAt: "2020-05-01T00:00:00.000Z",
        });

        const profile = await userService.getProfile("user-2", false);

        expect(profile.createdAt).toBeUndefined();
    });
});

describe("UserService.getUsers", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
    });

    it("never includes emails in username search results", async () => {
        userRepoMocks.getUsersByUsername.mockResolvedValue([
            { id: "user-2", email: "user2@test.fr", username: "user2" },
        ]);

        const [profile] = await userService.getUsers("user-1", "user2");

        expect(profile.email).toBeUndefined();
    });
});

describe("UserService.requestDeletion", () => {
    let userService;

    beforeEach(async () => {
        vi.clearAllMocks();
        userService = new UserService();
        userRepoMocks.getUserById.mockResolvedValue({
            id: "user-1", password: await SecurityHelper.createHash("goodpassword"),
        });
    });

    it("throws a 404 when the user doesn't exist", async () => {
        userRepoMocks.getUserById.mockResolvedValue(null);

        await expect(userService.requestDeletion("user-1", "goodpassword")).rejects.toThrow("Utilisateur inconnu");
    });

    it("rejects an incorrect password without marking the account for deletion", async () => {
        await expect(userService.requestDeletion("user-1", "wrongpassword")).rejects.toThrow(
            ERROR_BAD_PASSWORD
        );
        expect(userRepoMocks.requestDeletion).not.toHaveBeenCalled();
    });

    it("marks the account for deletion", async () => {
        userRepoMocks.requestDeletion.mockResolvedValue(true);

        await userService.requestDeletion("user-1", "goodpassword");

        expect(userRepoMocks.requestDeletion).toHaveBeenCalledWith("user-1");
    });

    it("throws a 500 when the database update fails", async () => {
        userRepoMocks.requestDeletion.mockResolvedValue(false);

        await expect(userService.requestDeletion("user-1", "goodpassword")).rejects.toThrow(
            "Impossible de supprimer le compte"
        );
    });
});
