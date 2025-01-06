import { comparePassword, createHash } from "../helpers/security.js";
import UserProfile from "../models/userProfile.js";
import {
    isValidImage,
    isValidChangePassword,
    isValidChangeEmail
} from "../helpers/validator.js";
import UserRepository from "../repositories/userRepository.js";
import ServiceError from "../models/serviceError.js";

export default class UserService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * @param {string} currentUserId
     * @param {string?} username
     * @returns {Promise<UserProfile[]>}
     */
    getUser = async (currentUserId, username) => {
        if (!username) {
            throw new ServiceError(400, "Requête invalide");
        }
        return (await this.userRepository.getUserByUsername(username)).reduce((acc, curr) => {
            const user = new UserProfile(curr);

            if (user.id !== currentUserId) {
                acc.push(user);
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
        const rows = await this.userRepository.getUserById(userId);

        if (rows.length === 1) {
            return new UserProfile(rows[0], isCurrentUser);
        }
        throw new ServiceError(404, "Profil introuvable");
    }

    /**
     * @param {string} currentUserId
     * @param {string?} currentPassword
     * @param {string?} newPassword
     * @param {string?} confirmPassword
     * @param {string?} email
     * @param {string?} newEmail
     * @param {string?} image
     * @returns {Promise<string>}
     */
    changeProfile = async (currentUserId, currentPassword, newPassword, confirmPassword, email, newEmail, image) => {
        if (currentPassword && newPassword && confirmPassword) {
            await this.#changePassword(currentUserId, currentPassword, newPassword, confirmPassword);
            return "Mot de passe modifié";
        } else if (email && newEmail) {
            await this.#changeEmail(currentUserId, email, newEmail);
            return "Email modifié";
        } else if (image) {
            await this.#changeImage(currentUserId, image);
            return "Image de profil définie";
        }
        throw new ServiceError(400, "Requête invalide");
    }

    /**
     * @param {string} currentUserId
     * @param {string?} image
     * @returns {Promise<void>}
     */
    #changeImage = async (currentUserId, image) => {
        if (!isValidImage(image)) {
            throw new ServiceError(400, "Image invalide");
        }
        await this.userRepository.updatePicture(currentUserId, image);
    }

    /**
     * @param {string} userId
     * @param {string?} currentPass
     * @param {string?} newPass
     * @param {string?} confirmPass
     * @returns {Promise<void>}
     */
    #changePassword = async (userId, currentPass, newPass, confirmPass) => {
        const changeValid = isValidChangePassword(currentPass, newPass, confirmPass);

        if (!changeValid.status) {
            throw new Error(changeValid.message);
        }
        const rows = await this.userRepository.getUserById(userId);

        if (rows.length === 0) {
            throw new ServiceError(404, "Utilisateur inconnu");
        }
        const same = await comparePassword(currentPass, rows[0]["password"]);

        if (!same) {
            throw new ServiceError(400, "Mot de passe incorrect");
        }
        const hash = await createHash(newPass);
        await this.userRepository.updatePassword(userId, hash);
    }

    /**
     * @param {string} currentUserId
     * @param {string?} email
     * @param {string?} newEmail
     * @returns {Promise<void>}
     */
    #changeEmail = async (currentUserId, email, newEmail) => {
        const changeValid = isValidChangeEmail(email, newEmail);

        if (!changeValid.status) {
            throw new ServiceError(400, changeValid.message);
        }
        let rows = await this.userRepository.getUserById(currentUserId);

        if (rows.length === 0) {
            throw new ServiceError(404, "Utilisateur inconnu");
        }
        if (rows[0]["email"] !== email) {
            throw new ServiceError(400, "Email incorrect");
        }
        if (email === newEmail) {
            throw new ServiceError(400, "Le nouvel mail doit être différent de l'ancien");
        }
        rows = await this.userRepository.getUserByEmail(newEmail);

        if (rows.length > 0) {
            throw new ServiceError(409, "Cet email est déjà associé à un compte");
        }
        await this.userRepository.updateEmail(currentUserId, newEmail);
    }
}