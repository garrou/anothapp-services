import { describe, it, expect, beforeEach } from "vitest";
import db from "../../../config/db.js";
import UserService from "../../../services/userService.js";
import AuthService from "../../../services/authService.js";
import SecurityHelper from "../../../helpers/security.js";
import UserUpdate from "../../../models/userUpdate.js";
import { resetDb } from "../resetDb.js";
import { insertUser } from "../fixtures.js";

describe("UserService (real Postgres)", () => {
    /** @type {UserService} */
    let service;

    beforeEach(async () => {
        await resetDb();
        service = new UserService();
    });

    describe("getUser / getProfile", () => {
        it("returns the user by id", async () => {
            const userId = await insertUser({ username: "Alice" });

            const result = await service.getUser(userId);

            expect(result.username).toBe("Alice");
        });

        it("getProfile returns createdAt for the current user but strips it for someone else", async () => {
            const userId = await insertUser();

            const own = await service.getProfile(userId, true);
            const other = await service.getProfile(userId, false);

            expect(own.createdAt).toBeDefined();
            expect(other.createdAt).toBeUndefined();
        });

        it("getProfile throws 404 when the user does not exist", async () => {
            await expect(service.getProfile("00000000-0000-0000-0000-000000000000", true))
                .rejects.toMatchObject({ status: 404 });
        });
    });

    describe("getUsers", () => {
        it("returns matching users, excluding the current user", async () => {
            const currentUserId = await insertUser({ username: "SearchTarget" });
            const matchId = await insertUser({ username: "SearchTargetTwo" });

            const result = await service.getUsers(currentUserId, "SearchTarget");

            expect(result.map((u) => u.id)).toEqual([matchId]);
        });

        it("throws 400 when no username is given", async () => {
            const currentUserId = await insertUser();

            await expect(service.getUsers(currentUserId, undefined)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateUser - password change", () => {
        it("changes the password when the current one matches", async () => {
            const hash = await SecurityHelper.createHash("OldPassword1");
            const userId = await insertUser({ password: hash });

            const message = await service.updateUser(userId, new UserUpdate({
                currentPassword: "OldPassword1", newPassword: "NewPassword1", confirmPassword: "NewPassword1",
            }));

            expect(message).toBe("Mot de passe modifié");
            const user = await service.getUser(userId);
            expect(await SecurityHelper.comparePassword("NewPassword1", user.password)).toBe(true);
        });

        it("rejects when the current password is wrong", async () => {
            const hash = await SecurityHelper.createHash("OldPassword1");
            const userId = await insertUser({ password: hash });

            await expect(service.updateUser(userId, new UserUpdate({
                currentPassword: "WrongPassword", newPassword: "NewPassword1", confirmPassword: "NewPassword1",
            }))).rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateUser - email change", () => {
        it("sets a pending email and revokes sessions, without touching the current (already verified) email", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ email: "old@test.fr", password: hash, emailVerified: true });
            await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'h', NOW() + INTERVAL '1 day')`, [userId]);

            const message = await service.updateUser(userId, new UserUpdate({
                newEmail: "new@test.fr", confirmEmail: "new@test.fr", currentPassword: "GoodPassword1",
            }));

            expect(message).toBe("Vérifiez votre nouvelle adresse email pour confirmer le changement");
            const user = await service.getUser(userId);
            expect(user.email).toBe("old@test.fr");
            expect(user.emailVerified).toBe(true);
            expect(user.pendingEmail).toBe("new@test.fr");
            const tokens = await db.query(`SELECT revoked_at FROM refresh_tokens WHERE user_id = $1`, [userId]);
            expect(tokens.rows[0]["revoked_at"]).not.toBeNull();
        });

        it("moves the pending email into email once its confirmation link is used", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ email: "old@test.fr", password: hash, emailVerified: true });

            await service.updateUser(userId, new UserUpdate({
                newEmail: "new@test.fr", confirmEmail: "new@test.fr", currentPassword: "GoodPassword1",
            }));
            const token = SecurityHelper.signJwt(userId, SecurityHelper.emailVerificationSecret(), "1d");
            await new AuthService().verifyEmail(token);

            const user = await service.getUser(userId);
            expect(user.email).toBe("new@test.fr");
            expect(user.emailVerified).toBe(true);
            expect(user.pendingEmail).toBeNull();
        });

        it("rejects mismatched email confirmation", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ email: "old@test.fr", password: hash });

            await expect(service.updateUser(userId, new UserUpdate({
                newEmail: "new@test.fr", confirmEmail: "different@test.fr", currentPassword: "GoodPassword1",
            }))).rejects.toMatchObject({ status: 400 });
        });

        it("rejects a wrong current password", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ email: "old@test.fr", password: hash });

            await expect(service.updateUser(userId, new UserUpdate({
                newEmail: "new@test.fr", confirmEmail: "new@test.fr", currentPassword: "WrongPassword",
            }))).rejects.toMatchObject({ status: 400 });
        });

        it("rejects when the new email is already taken", async () => {
            const hash = await SecurityHelper.createHash("GoodPassword1");
            const userId = await insertUser({ email: "mine@test.fr", password: hash });
            await insertUser({ email: "taken@test.fr" });

            await expect(service.updateUser(userId, new UserUpdate({
                newEmail: "taken@test.fr", confirmEmail: "taken@test.fr", currentPassword: "GoodPassword1",
            }))).rejects.toMatchObject({ status: 409 });
        });
    });

    describe("updateUser - image change", () => {
        it("changes the profile picture", async () => {
            const userId = await insertUser();

            const message = await service.updateUser(userId, new UserUpdate({ image: "https://pictures.betaseries.com/pic.jpg" }));

            expect(message).toBe("Image de profil définie");
        });

        it("rejects an invalid image url", async () => {
            const userId = await insertUser();

            await expect(service.updateUser(userId, new UserUpdate({ image: "https://evil.com/pic.jpg" })))
                .rejects.toMatchObject({ status: 400 });
        });
    });

    describe("updateUser - episode tracking", () => {
        it("disables episode tracking without needing any external lookup", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: true });

            const message = await service.updateUser(userId, new UserUpdate({ episodeTrackingEnabled: false }));

            expect(message).toBe("Suivi des épisodes désactivé");
            const res = await db.query(`SELECT episode_tracking_enabled FROM users WHERE id = $1`, [userId]);
            expect(res.rows[0]["episode_tracking_enabled"]).toBe(false);
        });

        it("enables episode tracking and backfills (no-op when the user has no watched seasons)", async () => {
            const userId = await insertUser({ episodeTrackingEnabled: false });

            const message = await service.updateUser(userId, new UserUpdate({ episodeTrackingEnabled: true }));

            expect(message).toBe("Suivi des épisodes activé");
        });
    });

    describe("requestDeletion", () => {
        it("marks the account as pending deletion when the password matches", async () => {
            const hash = await SecurityHelper.createHash("MyPassword1");
            const userId = await insertUser({ password: hash });

            await service.requestDeletion(userId, "MyPassword1");

            const user = await service.getUser(userId);
            expect(user.deletedAt).not.toBeNull();
        });

        it("rejects with the wrong password", async () => {
            const hash = await SecurityHelper.createHash("MyPassword1");
            const userId = await insertUser({ password: hash });

            await expect(service.requestDeletion(userId, "WrongPassword")).rejects.toMatchObject({ status: 400 });
        });

        it("rejects for an unknown user", async () => {
            await expect(service.requestDeletion("00000000-0000-0000-0000-000000000000", "x"))
                .rejects.toMatchObject({ status: 404 });
        });

        it("refuses to delete the admin account, even with the correct password", async () => {
            const hash = await SecurityHelper.createHash("MyPassword1");
            const userId = await insertUser({ password: hash });
            process.env.ADMIN_ID = userId;

            try {
                await expect(service.requestDeletion(userId, "MyPassword1")).rejects.toMatchObject({ status: 403 });
                const user = await service.getUser(userId);
                expect(user.deletedAt).toBeNull();
            } finally {
                delete process.env.ADMIN_ID;
            }
        });
    });
});
