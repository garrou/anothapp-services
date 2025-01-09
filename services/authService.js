import UserRepository from "../repositories/userRepository.js";
import UserProfile from "../models/userProfile.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import {ERROR_LOGIN_PASSWORD} from "../constants/errors.js";

export default class AuthService {
    constructor() {
        this._userRepository = new UserRepository();
    }

    /**
     * @param {string?} identifier
     * @param {string?} password
     * @returns {Promise<{token: string, id: string, email: string, picture: string, username: string, current: boolean}>}
     */
    login = async (identifier, password) => {
        const found = await this._userRepository.getUserByIdentifier(identifier);

        if (!found) {
            throw new ServiceError(400, ERROR_LOGIN_PASSWORD);
        }
        const same = await SecurityHelper.comparePassword(password, found.password);

        if (!same) {
            throw new ServiceError(400, ERROR_LOGIN_PASSWORD);
        }
        const token = SecurityHelper.signJwt(found.id, process.env.JWT_SECRET);
        const user = new UserProfile(found, true);
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
        const nameValid = Validator.isValidUsername(username);

        if (!nameValid.status) {
            throw new ServiceError(400, nameValid.message);
        }
        const emailValid = Validator.isValidEmail(email);

        if (!emailValid.status) {
            throw new ServiceError(400, emailValid.message);
        }
        const passValid = Validator.isValidPassword(password, confirm);

        if (!passValid.status) {
            throw new ServiceError(400, passValid.message);
        }
        const user = await this._userRepository.getUserByEmail(email);

        if (user) {
            throw new ServiceError(409, "Un compte est déjà associé à cet email");
        }
        const users = await this._userRepository.getUserByUsername(username, true);

        if (users.length > 0) {
            throw new ServiceError(409, "Un compte est déjà associé à ce nom d'utilisateur");
        }
        const hash = await SecurityHelper.createHash(password);
        const created = await this._userRepository.createUser(SecurityHelper.generateUuid(), email, hash, username);

        if (!created) {
            throw new ServiceError(500, "Impossible de créer le compte");
        }
    }
}