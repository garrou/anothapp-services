import UserRepository from "../repositories/userRepository.js";
import {isValidEmail, isValidId, isValidPassword, isValidUsername} from "../helpers/validator.js";
import {comparePassword, createHash, signJwt, uuid} from "../helpers/security.js";
import UserProfile from "../models/userProfile.js";
import ServiceError from "../models/serviceError.js";

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
        if (!isValidId(identifier)) {
            throw new ServiceError(400, "Identifiant incorrect");
        }
        const rows = await this._userRepository.getUserByIdentifier(identifier);

        if (rows.length === 0) {
            throw new ServiceError(400, "Identifiant ou mot de passe incorrect");
        }
        const same = await comparePassword(password, rows[0]["password"]);

        if (!same) {
            throw new ServiceError(400, "Identifiant ou mot de passe incorrect");
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
            throw new ServiceError(400, nameValid.message);
        }
        const emailValid = isValidEmail(email);

        if (!emailValid.status) {
            throw new ServiceError(400, emailValid.message);
        }
        const passValid = isValidPassword(password, confirm);

        if (!passValid.status) {
            throw new ServiceError(400, passValid.message);
        }
        let rows = await this._userRepository.getUserByEmail(email);

        if (rows.length > 0) {
            throw new ServiceError(409, "Un compte est déjà associé à cet email");
        }
        rows = await this._userRepository.getUserByUsername(username, true);

        if (rows.length > 0) {
            throw new ServiceError(409, "Un compte est déjà associé à ce nom d'utilisateur");
        }
        const hash = await createHash(password);
        await this._userRepository.createUser(uuid(), email, hash, username);
    }
}