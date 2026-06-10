import UserRepository from "../repositories/userRepository.js";
import UserProfile from "../models/userProfile.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import { ERROR_LOGIN_PASSWORD } from "../constants/errors.js";
import { DUMMY_HASH } from "../constants/security.js";

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
        const hashToCompare = found?.password ?? DUMMY_HASH;
        const same = await SecurityHelper.comparePassword(password, hashToCompare);

        if (!found || !same) {
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
        const validations = [
            Validator.isValidUsername(username),
            Validator.isValidEmail(email),
            Validator.isValidPassword(password, confirm),
        ];

        for (const result of validations) {
            if (!result.status) throw new ServiceError(400, result.message);
        }
        const hash = await SecurityHelper.createHash(password);

        try {
            const created = await this._userRepository.createUser(email, hash, username);
            if (!created) throw new ServiceError(500, "Impossible de créer le compte");
        } catch (err) {
            if (err.code === '23505') {
                throw new ServiceError(409, "Un compte est déjà associé à ces informations");
            }
            throw err;
        }
    }
}