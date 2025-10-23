import UserProfile from "../models/userProfile.js";
import UserRepository from "../repositories/userRepository.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";

export default class UserService {
    constructor() {
        this._userRepository = new UserRepository();
    }

    /**
     * {string} userId
     * @returns {Promise<User>}
     */
    getUser = async (userId) => {
        return this._userRepository.getUserById(userId);
    }

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
        const user = await this._userRepository.getUserById(userId);

        if (user) {
            return new UserProfile(user, isCurrentUser);
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
            await this.#changeEmail(currentUserId, userUpdate.email, userUpdate.newEmail);
            return "Email modifié";
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
        const user = await this._userRepository.getUserById(userId);

        if (!user) {
            throw new ServiceError(404, "Utilisateur inconnu");
        }
        const same = await SecurityHelper.comparePassword(currentPass, user.password);

        if (!same) {
            throw new ServiceError(400, "Mot de passe incorrect");
        }
        const hash = await SecurityHelper.createHash(newPass);
        const updated = await this._userRepository.updateField(userId, "password", hash);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier le mot de passe");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string} email
     * @param {string} newEmail
     * @returns {Promise<void>}
     */
    #changeEmail = async (currentUserId, email, newEmail) => {
        const changeValid = Validator.isValidChangeEmail(email, newEmail);

        if (!changeValid.status) {
            throw new ServiceError(400, changeValid.message);
        }
        let user = await this._userRepository.getUserById(currentUserId);

        if (!user) {
            throw new ServiceError(404, "Utilisateur inconnu");
        }
        if (user.email !== email) {
            throw new ServiceError(400, "Email incorrect");
        }
        if (email === newEmail) {
            throw new ServiceError(400, "Le nouvel email doit être différent de l'ancien");
        }
        user = await this._userRepository.getUserByEmail(newEmail);

        if (user) {
            throw new ServiceError(409, "Cet email est déjà associé à un compte");
        }
        const updated = await this._userRepository.updateField(currentUserId, "email", newEmail);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier l'email");
        }
    }
}