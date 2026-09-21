import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import UserService from "../../../services/userService.js";
import UserUpdate from "../../../models/userUpdate.js";
import SecurityHelper from "../../../helpers/security.js";
import { ERROR_BAD_PASSWORD } from "../../../constants/errors.js";

const userRepoMocks = vi.hoisted(() => ({
    updateField: vi.fn(),
    getUserWithAuthById: vi.fn(),
    getUsersByUsername: vi.fn(),
    requestDeletion: vi.fn(),
}));
const userAuthRepoMocks = vi.hoisted(() => ({
    getByUserId: vi.fn(),
    getByEmail: vi.fn(),
    updateField: vi.fn(),
}));
const authServiceMocks = vi.hoisted(() => ({
    issueEmailVerification: vi.fn().mockResolvedValue(undefined),
}));
const refreshTokenRepoMocks = vi.hoisted(() => ({
    revokeAllForUser: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
    // runs the callback with a stand-in client - the mocked repositories below don't care what
    // they receive as their `client` argument, they just record it
    transaction: vi.fn((callback) => callback({ query: vi.fn() })),
}));

vi.mock("../../../repositories/userRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userRepoMocks; }),
}));
vi.mock("../../../repositories/userAuthRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return userAuthRepoMocks; }),
}));
vi.mock("../../../repositories/refreshTokenRepository.js", () => ({
    default: vi.fn().mockImplementation(function () { return refreshTokenRepoMocks; }),
}));
vi.mock("../../../services/authService.js", () => ({
    default: vi.fn().mockImplementation(function () { return authServiceMocks; }),
}));
vi.mock("../../../config/db.js", () => ({ default: dbMocks }));

describe("UserService.updateUser - password change", () => {
    let userService;

    beforeEach(async () => {
        vi.clearAllMocks();
        userService = new UserService();
        userAuthRepoMocks.getByUserId.mockResolvedValue({
            password: await SecurityHelper.createHash("goodpassword"),
        });
    });

    it("hashes and stores the new password on users_auth", async () => {
        userAuthRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser(
            "user-1", new UserUpdate({ currentPassword: "goodpassword", newPassword: "NewPassword1", confirmPassword: "NewPassword1" })
        );

        expect(userAuthRepoMocks.updateField).toHaveBeenCalledWith("user-1", "password_hash", expect.any(String));
        expect(message).toBe("Mot de passe modifié");
    });

    it("rejects an incorrect current password", async () => {
        await expect(userService.updateUser(
            "user-1", new UserUpdate({ currentPassword: "wrongpassword", newPassword: "NewPassword1", confirmPassword: "NewPassword1" })
        )).rejects.toMatchObject({ status: 400, message: ERROR_BAD_PASSWORD });
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("throws a 404 when the account has no auth row", async () => {
        userAuthRepoMocks.getByUserId.mockResolvedValue(null);

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ currentPassword: "goodpassword", newPassword: "NewPassword1", confirmPassword: "NewPassword1" })
        )).rejects.toThrow("Utilisateur inconnu");
    });

    it("throws a 500 when the database update fails", async () => {
        userAuthRepoMocks.updateField.mockResolvedValue(false);

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ currentPassword: "goodpassword", newPassword: "NewPassword1", confirmPassword: "NewPassword1" })
        )).rejects.toThrow("Impossible de modifier le mot de passe");
    });
});

describe("UserService.updateUser - email change", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
    });

    it("sets a pending email, revokes sessions, and sends a confirmation to the new address - without touching the current (already verified) email", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "old@test.fr", password: hash });
        userAuthRepoMocks.getByEmail.mockResolvedValue(null);
        userAuthRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser(
            "user-1", new UserUpdate({ newEmail: "new@test.fr", confirmEmail: "new@test.fr", currentPassword: "GoodPassword1" })
        );

        expect(message).toBe("Vérifiez votre nouvelle adresse email pour confirmer le changement");
        expect(userAuthRepoMocks.updateField).toHaveBeenCalledWith("user-1", "pending_email", "new@test.fr", expect.anything());
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalledWith("user-1", "email", expect.anything(), expect.anything());
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalledWith("user-1", "email_verified", expect.anything(), expect.anything());
        expect(refreshTokenRepoMocks.revokeAllForUser).toHaveBeenCalledWith("user-1", expect.anything());
        expect(authServiceMocks.issueEmailVerification).toHaveBeenCalledWith("user-1", "new@test.fr");
        expect(dbMocks.transaction).toHaveBeenCalled();
    });

    it("rejects mismatched email confirmation, without touching anything", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "old@test.fr", password: hash });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newEmail: "new@test.fr", confirmEmail: "different@test.fr", currentPassword: "GoodPassword1" })
        )).rejects.toMatchObject({ status: 400 });

        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
        expect(refreshTokenRepoMocks.revokeAllForUser).not.toHaveBeenCalled();
        expect(authServiceMocks.issueEmailVerification).not.toHaveBeenCalled();
    });

    it("rejects a missing or wrong current password, without touching anything", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "old@test.fr", password: hash });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newEmail: "new@test.fr", confirmEmail: "new@test.fr" })
        )).rejects.toMatchObject({ status: 400, message: ERROR_BAD_PASSWORD });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newEmail: "new@test.fr", confirmEmail: "new@test.fr", currentPassword: "WrongPassword" })
        )).rejects.toMatchObject({ status: 400, message: ERROR_BAD_PASSWORD });

        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
        expect(refreshTokenRepoMocks.revokeAllForUser).not.toHaveBeenCalled();
        expect(authServiceMocks.issueEmailVerification).not.toHaveBeenCalled();
    });

    it("rejects when the new email is already taken, without touching the verification flag", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "old@test.fr", password: hash });
        userAuthRepoMocks.getByEmail.mockResolvedValue({ userId: "user-2" });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newEmail: "taken@test.fr", confirmEmail: "taken@test.fr", currentPassword: "GoodPassword1" })
        )).rejects.toMatchObject({ status: 409 });
        expect(userAuthRepoMocks.updateField).not.toHaveBeenCalled();
        expect(authServiceMocks.issueEmailVerification).not.toHaveBeenCalled();
    });

    it("does not fail the email change just because the verification email couldn't be sent", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userAuthRepoMocks.getByUserId.mockResolvedValue({ email: "old@test.fr", password: hash });
        userAuthRepoMocks.getByEmail.mockResolvedValue(null);
        userAuthRepoMocks.updateField.mockResolvedValue(true);
        authServiceMocks.issueEmailVerification.mockRejectedValueOnce(new Error("SMTP down"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const message = await userService.updateUser(
            "user-1", new UserUpdate({ newEmail: "new@test.fr", confirmEmail: "new@test.fr", currentPassword: "GoodPassword1" })
        );

        expect(message).toBe("Vérifiez votre nouvelle adresse email pour confirmer le changement");
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

describe("UserService.updateUser - username change", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
    });

    it("changes the username immediately, without a transaction or session revocation", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserWithAuthById.mockResolvedValue({ username: "oldname", password: hash });
        userRepoMocks.getUsersByUsername.mockResolvedValue([]);
        userRepoMocks.updateField.mockResolvedValue(true);

        const message = await userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "newname", confirmUsername: "newname", currentPassword: "GoodPassword1" })
        );

        expect(message).toBe("Nom d'utilisateur modifié");
        expect(userRepoMocks.updateField).toHaveBeenCalledWith("user-1", "username", "newname");
        expect(refreshTokenRepoMocks.revokeAllForUser).not.toHaveBeenCalled();
        expect(dbMocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects mismatched username confirmation, without touching anything", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserWithAuthById.mockResolvedValue({ username: "oldname", password: hash });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "newname", confirmUsername: "othername", currentPassword: "GoodPassword1" })
        )).rejects.toMatchObject({ status: 400 });

        expect(userRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("rejects a username identical to the current one", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserWithAuthById.mockResolvedValue({ username: "oldname", password: hash });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "oldname", confirmUsername: "oldname", currentPassword: "GoodPassword1" })
        )).rejects.toMatchObject({ status: 400 });

        expect(userRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("rejects a missing or wrong current password, without touching anything", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserWithAuthById.mockResolvedValue({ username: "oldname", password: hash });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "newname", confirmUsername: "newname" })
        )).rejects.toMatchObject({ status: 400, message: ERROR_BAD_PASSWORD });

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "newname", confirmUsername: "newname", currentPassword: "WrongPassword" })
        )).rejects.toMatchObject({ status: 400, message: ERROR_BAD_PASSWORD });

        expect(userRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("throws a 404 when the account has no user row", async () => {
        userRepoMocks.getUserWithAuthById.mockResolvedValue(null);

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "newname", confirmUsername: "newname", currentPassword: "GoodPassword1" })
        )).rejects.toThrow("Utilisateur inconnu");
    });

    it("rejects when the new username is already taken", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserWithAuthById.mockResolvedValue({ username: "oldname", password: hash });
        userRepoMocks.getUsersByUsername.mockResolvedValue([{ id: "user-2" }]);

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "taken", confirmUsername: "taken", currentPassword: "GoodPassword1" })
        )).rejects.toMatchObject({ status: 409 });

        expect(userRepoMocks.updateField).not.toHaveBeenCalled();
    });

    it("throws a 500 when the database update fails", async () => {
        const hash = await SecurityHelper.createHash("GoodPassword1");
        userRepoMocks.getUserWithAuthById.mockResolvedValue({ username: "oldname", password: hash });
        userRepoMocks.getUsersByUsername.mockResolvedValue([]);
        userRepoMocks.updateField.mockResolvedValue(false);

        await expect(userService.updateUser(
            "user-1", new UserUpdate({ newUsername: "newname", confirmUsername: "newname", currentPassword: "GoodPassword1" })
        )).rejects.toThrow("Impossible de modifier le nom d'utilisateur");
    });
});

describe("UserService.getProfile", () => {
    let userService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService();
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "user-2", username: "user2", picture: null,
            email: "user2@test.fr",
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
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "user-2", username: "user2", picture: null,
            createdAt: "2020-05-01T00:00:00.000Z",
        });

        const profile = await userService.getProfile("user-2", true);

        expect(profile.createdAt).toBe("2020-05-01T00:00:00.000Z");
    });

    it("never includes createdAt when viewing another user's profile (GET /users/:id has no friendship check)", async () => {
        userRepoMocks.getUserWithAuthById.mockResolvedValue({
            id: "user-2", username: "user2", picture: null,
            createdAt: "2020-05-01T00:00:00.000Z",
        });

        const profile = await userService.getProfile("user-2", false);

        expect(profile.createdAt).toBeUndefined();
    });

    it("throws a 404 when the account doesn't exist", async () => {
        userRepoMocks.getUserWithAuthById.mockResolvedValue(null);

        await expect(userService.getProfile("unknown", true)).rejects.toThrow("Profil introuvable");
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
            { id: "user-2", username: "user2" },
        ]);

        const [profile] = await userService.getUsers("user-1", "user2");

        expect(profile.email).toBeUndefined();
    });
});

describe("UserService.requestDeletion", () => {
    let userService;

    beforeAll(() => {
        process.env.ADMIN_ID = "admin-1";
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        userService = new UserService();
        userAuthRepoMocks.getByUserId.mockResolvedValue({
            password: await SecurityHelper.createHash("goodpassword"),
        });
    });

    it("rejects deleting the admin account, without checking the password", async () => {
        const compareSpy = vi.spyOn(SecurityHelper, "comparePassword");

        await expect(userService.requestDeletion("admin-1", "goodpassword")).rejects.toMatchObject({
            status: 403, message: "Impossible de supprimer le compte administrateur",
        });
        // the 404 (account exists?) check still runs first - the admin guard only kicks in once
        // we know there's a real account behind that id
        expect(userAuthRepoMocks.getByUserId).toHaveBeenCalledWith("admin-1");
        expect(compareSpy).not.toHaveBeenCalled();
        expect(userRepoMocks.requestDeletion).not.toHaveBeenCalled();
    });

    it("throws a 404 when the account has no auth row", async () => {
        userAuthRepoMocks.getByUserId.mockResolvedValue(null);

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
