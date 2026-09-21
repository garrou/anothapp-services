import UserProfile from "../models/userProfile.js";
import UserRepository from "../repositories/userRepository.js";
import UserAuthRepository from "../repositories/userAuthRepository.js";
import RefreshTokenRepository from "../repositories/refreshTokenRepository.js";
import AuthService from "./authService.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import { ERROR_BAD_PASSWORD, ERROR_INVALID_REQUEST, ERROR_UNKNOWN_USER } from "../constants/errors.js";
import { sanitizeErrorForLog } from "../helpers/utils.js";
import db from "../config/db.js";

export default class UserService {
    constructor() {
        this._userRepository = new UserRepository();
        this._userAuthRepository = new UserAuthRepository();
        this._authService = new AuthService();
        this._refreshTokenRepository = new RefreshTokenRepository();
    }

    /**
     * {string} userId
     * @returns {Promise<Object>}
     */
    getUser = async (userId) => this._userRepository.getUserWithAuthById(userId);

    /**
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    markExported = (userId) => this._userRepository.markExported(userId);

    /**
     * @param {string} currentUserId
     * @param {string?} username
     * @returns {Promise<UserProfile[]>}
     */
    getUsers = async (currentUserId, username) => {
        if (!username) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        return (await this._userRepository.getUsersByUsername(username)).reduce((acc, user) => {
            if (user.id !== currentUserId) {
                acc.push(new UserProfile(user));
            }
            return acc;
        }, []);
    }

    /**
     * @param {string} userId
     * @param {boolean} isCurrentUser
     * @returns {Promise<UserProfile>}
     */
    getProfile = async (userId, isCurrentUser) => {
        const user = await this._userRepository.getUserWithAuthById(userId);

        if (user) {
            const profile = new UserProfile(user, isCurrentUser);
            if (!isCurrentUser) {
                delete profile.createdAt;
            }
            return profile;
        }
        throw new ServiceError(404, "Profil introuvable");
    }

    /**
     * @param {string} currentUserId
     * @param {UserUpdate} userUpdate
     * @returns {Promise<string>}
     */
    updateUser = async (currentUserId, userUpdate) => {
        if (userUpdate.isPasswordUpdate()) {
            await this.#changePassword(currentUserId, userUpdate.currentPassword, userUpdate.newPassword, userUpdate.confirmPassword);
            return "Mot de passe modifié";
        } else if (userUpdate.isEmailUpdate()) {
            await this.#changeEmail(currentUserId, userUpdate.newEmail, userUpdate.confirmEmail, userUpdate.currentPassword);
            return "Vérifiez votre nouvelle adresse email pour confirmer le changement";
        } else if (userUpdate.isUsernameUpdate()) {
            await this.#changeUsername(currentUserId, userUpdate.newUsername, userUpdate.confirmUsername, userUpdate.currentPassword);
            return "Nom d'utilisateur modifié";
        } else if (userUpdate.image) {
            await this.#changeImage(currentUserId, userUpdate.image);
            return "Image de profil définie";
        } else if (userUpdate.lastExport) {
            await this.#changeLastExport(currentUserId, userUpdate.lastExport);
            return "Date de dernier export modifiée";
        }
        throw new ServiceError(400, ERROR_INVALID_REQUEST);
    }

    /**
     * @param {string} userId
     * @param {string} password
     * @returns {Promise<void>}
     */
    requestDeletion = async (userId, password) => {
        const auth = await this._userAuthRepository.getByUserId(userId);

        if (!auth) {
            throw new ServiceError(404, ERROR_UNKNOWN_USER);
        }
        if (userId === process.env.ADMIN_ID) {
            throw new ServiceError(403, "Impossible de supprimer le compte administrateur");
        }
        const same = await SecurityHelper.comparePassword(password, auth.password);

        if (!same) {
            throw new ServiceError(400, ERROR_BAD_PASSWORD);
        }
        const updated = await this._userRepository.requestDeletion(userId);

        if (!updated) {
            throw new ServiceError(500, "Impossible de supprimer le compte");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} lastExport
     * @returns {Promise<void>}
     */
    #changeLastExport = async (currentUserId, lastExport) => {
        const updated = await this._userRepository.updateField(currentUserId, "last_export", lastExport);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier la date");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} image
     * @returns {Promise<void>}
     */
    #changeImage = async (currentUserId, image) => {
        if (!Validator.isValidImage(image)) {
            throw new ServiceError(400, "Image invalide");
        }
        const updated = await this._userRepository.updateField(currentUserId, "picture", image);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier l'image");
        }
    }

    /**
     * @param {string} userId
     * @param {string} currentPass
     * @param {string} newPass
     * @param {string} confirmPass
     * @returns {Promise<void>}
     */
    #changePassword = async (userId, currentPass, newPass, confirmPass) => {
        const changeValid = Validator.isValidChangePassword(currentPass, newPass, confirmPass);

        if (!changeValid.status) {
            throw new Error(changeValid.message);
        }
        const auth = await this._userAuthRepository.getByUserId(userId);

        if (!auth) {
            throw new ServiceError(404, ERROR_UNKNOWN_USER);
        }
        const same = await SecurityHelper.comparePassword(currentPass, auth.password);

        if (!same) {
            throw new ServiceError(400, ERROR_BAD_PASSWORD);
        }
        const hash = await SecurityHelper.createHash(newPass);
        const updated = await this._userAuthRepository.updateField(userId, "password_hash", hash);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier le mot de passe");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} newEmail
     * @param {string} confirmEmail
     * @param {string} currentPassword
     * @returns {Promise<void>}
     */
    #changeEmail = async (currentUserId, newEmail, confirmEmail, currentPassword) => {
        if (!Validator.isString(currentPassword)) {
            throw new ServiceError(400, ERROR_BAD_PASSWORD);
        }
        const auth = await this._userAuthRepository.getByUserId(currentUserId);

        if (!auth) {
            throw new ServiceError(404, ERROR_UNKNOWN_USER);
        }
        const changeValid = Validator.isValidChangeEmail(auth.email, newEmail, confirmEmail);

        if (!changeValid.status) {
            throw new ServiceError(400, changeValid.message);
        }
        const same = await SecurityHelper.comparePassword(currentPassword, auth.password);

        if (!same) {
            throw new ServiceError(400, ERROR_BAD_PASSWORD);
        }
        const existing = await this._userAuthRepository.getByEmail(newEmail);

        if (existing) {
            throw new ServiceError(409, "Cet email est déjà associé à un compte");
        }
        const updated = await db.transaction(async (client) => {
            const changed = await this._userAuthRepository.updateField(currentUserId, "pending_email", newEmail, client);

            if (!changed) {
                return false;
            }
            await this._refreshTokenRepository.revokeAllForUser(currentUserId, client);
            return true;
        });

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier l'email");
        }
        this._authService.issueEmailVerification(currentUserId, newEmail).catch((err) => {
            console.error("Échec de l'envoi de l'email de confirmation", sanitizeErrorForLog(err));
        });
    }

    /**
     * @param {string} currentUserId
     * @param {string} newUsername
     * @param {string} confirmUsername
     * @param {string} currentPassword
     * @returns {Promise<void>}
     */
    #changeUsername = async (currentUserId, newUsername, confirmUsername, currentPassword) => {
        if (!Validator.isString(currentPassword)) {
            throw new ServiceError(400, ERROR_BAD_PASSWORD);
        }
        const user = await this._userRepository.getUserWithAuthById(currentUserId);

        if (!user) {
            throw new ServiceError(404, ERROR_UNKNOWN_USER);
        }
        const changeValid = Validator.isValidChangeUsername(user.username, newUsername, confirmUsername);

        if (!changeValid.status) {
            throw new ServiceError(400, changeValid.message);
        }
        const same = await SecurityHelper.comparePassword(currentPassword, user.password);

        if (!same) {
            throw new ServiceError(400, ERROR_BAD_PASSWORD);
        }
        const existing = await this._userRepository.getUsersByUsername(newUsername, true);

        if (existing.length) {
            throw new ServiceError(409, "Ce nom d'utilisateur est déjà pris");
        }
        const updated = await this._userRepository.updateField(currentUserId, "username", newUsername);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier le nom d'utilisateur");
        }
    }
}
