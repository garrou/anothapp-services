import UserProfile from "../models/userProfile.js";
import UserRepository from "../repositories/userRepository.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";

export default class UserService {
    constructor() {
        this._userRepository = new UserRepository();
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
        return (await this._userRepository.getUserByUsername(username)).reduce((acc, curr) => {
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
        const rows = await this._userRepository.getUserById(userId);

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
            await this._changePassword(currentUserId, currentPassword, newPassword, confirmPassword);
            return "Mot de passe modifié";
        } else if (email && newEmail) {
            await this._changeEmail(currentUserId, email, newEmail);
            return "Email modifié";
        } else if (image) {
            await this._changeImage(currentUserId, image);
            return "Image de profil définie";
        }
        throw new ServiceError(400, "Requête invalide");
    }

    /**
     * @param {string} currentUserId
     * @param {string?} image
     * @returns {Promise<void>}
     */
    _changeImage = async (currentUserId, image) => {
        if (!Validator.isValidImage(image)) {
            throw new ServiceError(400, "Image invalide");
        }
        const updated = await this._userRepository.updatePicture(currentUserId, image);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier l'image");
        }
    }

    /**
     * @param {string} userId
     * @param {string?} currentPass
     * @param {string?} newPass
     * @param {string?} confirmPass
     * @returns {Promise<void>}
     */
    _changePassword = async (userId, currentPass, newPass, confirmPass) => {
        const changeValid = Validator.isValidChangePassword(currentPass, newPass, confirmPass);

        if (!changeValid.status) {
            throw new Error(changeValid.message);
        }
        const rows = await this._userRepository.getUserById(userId);

        if (rows.length === 0) {
            throw new ServiceError(404, "Utilisateur inconnu");
        }
        const same = await SecurityHelper.comparePassword(currentPass, rows[0]["password"]);

        if (!same) {
            throw new ServiceError(400, "Mot de passe incorrect");
        }
        const hash = await SecurityHelper.createHash(newPass);
        const updated = await this._userRepository.updatePassword(userId, hash);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier le mot de passe");
        }
    }

    /**
     * @param {string} currentUserId
     * @param {string?} email
     * @param {string?} newEmail
     * @returns {Promise<void>}
     */
    _changeEmail = async (currentUserId, email, newEmail) => {
        const changeValid = Validator.isValidChangeEmail(email, newEmail);

        if (!changeValid.status) {
            throw new ServiceError(400, changeValid.message);
        }
        let rows = await this._userRepository.getUserById(currentUserId);

        if (rows.length === 0) {
            throw new ServiceError(404, "Utilisateur inconnu");
        }
        if (rows[0]["email"] !== email) {
            throw new ServiceError(400, "Email incorrect");
        }
        if (email === newEmail) {
            throw new ServiceError(400, "Le nouvel mail doit être différent de l'ancien");
        }
        rows = await this._userRepository.getUserByEmail(newEmail);

        if (rows.length > 0) {
            throw new ServiceError(409, "Cet email est déjà associé à un compte");
        }
        const updated = await this._userRepository.updateEmail(currentUserId, newEmail);

        if (!updated) {
            throw new ServiceError(500, "Impossible de modifier l'email");
        }
    }
}