import { comparePassword, createHash, uuid, signJwt } from "../helpers/security.js";
import UserProfile from "../models/userProfile.js";
import {
    isValidEmail,
    isValidUsername,
    isValidPassword,
    isValidImage,
    isValidId,
    isValidChangePassword,
    isValidChangeEmail
} from "../helpers/validator.js";
import UserRepository from "../repositories/userRepository.js";

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
            throw new Error("Requête invalide");
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
     * @param {string?} identifier
     * @param {string?} password
     * @returns {Promise<{token: string, id: string, email: string, picture: string, username: string, current: boolean}>}
     */
    login = async (identifier, password) => {
        if (!isValidId(identifier)) {
            throw new Error("Identifiant incorrect");
        }
        const rows = await this.userRepository.getUserByIdentifier(identifier);

        if (rows.length === 0) {
            throw new Error("Identifiant ou mot de passe incorrect");
        }
        const same = await comparePassword(password, rows[0]["password"]);

        if (!same) {
            throw new Error("Identifiant ou mot de passe incorrect");
        }
        const token = signJwt(rows[0]["id"], process.env.JWT_SECRET);
        const user = new UserProfile(rows[0], true);
        return {
            "token": token,
            ...user,
        }
    }

    /**
     * @param {string?} email
     * @param {string?} username
     * @param {string?} password
     * @param {string?} confirm
     * @returns {Promise<void>}
     */
    register = async (email, username, password, confirm) => {
        const nameValid = isValidUsername(username);

        if (!nameValid.status) {
            throw new Error(nameValid.message);
        }
        const emailValid = isValidEmail(email);

        if (!emailValid.status) {
           throw new Error(emailValid.message);
        }
        const passValid = isValidPassword(password, confirm);

        if (!passValid.status) {
            throw new Error(passValid.message);
        }
        let rows = await this.userRepository.getUserByEmail(email);

        if (rows.length > 0) {
            throw new Error("Un compte est déjà associé à cet email");
        }
        rows = await this.userRepository.getUserByUsername(username, true);

        if (rows.length > 0) {
            throw new Error("Un compte est déjà associé à ce nom d'utilisateur");
        }
        const hash = await createHash(password);
        await this.userRepository.createUser(uuid(), email, hash, username);
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
        throw new Error("Profil introuvable");
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
        throw new Error("Requête invalide");
    }

    /**
     * @param {string} currentUserId
     * @param {string?} image
     * @returns {Promise<void>}
     */
    #changeImage = async (currentUserId, image) => {
        if (!isValidImage(image)) {
            throw new Error("Image invalide");
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
            throw new Error("Utilisateur inconnu");
        }
        const same = await comparePassword(currentPass, rows[0]["password"]);

        if (!same) {
            throw new Error("Mot de passe incorrect");
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
            throw new Error(changeValid.message);
        }
        let rows = await this.userRepository.getUserById(currentUserId);

        if (rows.length === 0) {
            throw new Error("Utilisateur inconnu");
        }
        if (rows[0]["email"] !== email) {
            throw new Error("Email incorrect");
        }
        if (email === newEmail) {
            throw new Error("Le nouvel mail doit être différent de l'ancien");
        }
        rows = await this.userRepository.getUserByEmail(newEmail);

        if (rows.length > 0) {
            throw new Error("Cet email est déjà associé à un compte");
        }
        await this.userRepository.updateEmail(currentUserId, newEmail);
    }
}