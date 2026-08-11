import UserRepository from "../repositories/userRepository.js";
import UserProfile from "../models/userProfile.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import { ERROR_LOGIN_PASSWORD, ERROR_REFRESH_TOKEN_INVALID } from "../constants/errors.js";
import { DUMMY_HASH } from "../constants/security.js";
import RefreshTokenRepository from "../repositories/refreshTokenRepository.js";

export default class AuthService {
    constructor() {
        this._userRepository = new UserRepository();
        this._refreshTokenRepository = new RefreshTokenRepository();
    }

    /**
     * @param {string?} identifier
     * @param {string?} password
     * @returns {Promise<Object>}
     */
    login = async (identifier, password) => {
        const found = await this._userRepository.getUserByIdentifier(identifier);
        const hashToCompare = found?.password ?? DUMMY_HASH;
        const same = await SecurityHelper.comparePassword(password, hashToCompare);

        if (!found || !same) {
            throw new ServiceError(400, ERROR_LOGIN_PASSWORD);
        }
        const token = SecurityHelper.signJwt(found.id, process.env.JWT_SECRET);
        const refreshToken = SecurityHelper.generateRefreshToken();
        const created = await this._refreshTokenRepository.create(
            found.id,
            SecurityHelper.hashToken(refreshToken),
            new Date(Date.now() + SecurityHelper.refreshTokenExpires)
        );

        if (!created) {
            throw new ServiceError(500, "Erreur durant l'authentification");
        }
        const user = new UserProfile(found, true);
        return { token, refreshToken, user };
    }

    /**
     * @param {string} token 
     */
    logout = async (token) => {
        if (!token) {
            return;
        }
        const found = await this._refreshTokenRepository.find(SecurityHelper.hashToken(token));

        if (!found) {
            return;
        }
        const revoked = await this._refreshTokenRepository.revoke(found.id);

        if (!revoked) {
            throw new ServiceError(500, "Erreur durant la déconnexion");
        }
    }

    /**
     * @param {string} token 
     */
    refreshToken = async (token) => {
        const found = await this._refreshTokenRepository.find(SecurityHelper.hashToken(token));

        if (!found) {
            throw new ServiceError(401, ERROR_REFRESH_TOKEN_INVALID);
        }
        const revoked = await this._refreshTokenRepository.revoke(found.id);

        if (!revoked) {
            throw new ServiceError(500, "Erreur durant la revoquation");
        }
        const newRefreshToken = SecurityHelper.generateRefreshToken();
        const created = await this._refreshTokenRepository.create(
            found.userId,
            SecurityHelper.hashToken(newRefreshToken),
            new Date(Date.now() + SecurityHelper.refreshTokenExpires)
        );
        if (!created) {
            throw new ServiceError(500, "Erreur durant le rafraichissement");
        }
        const accessToken = SecurityHelper.signJwt(
            found.userId,
            process.env.JWT_SECRET
        );
        return {
            accessToken,
            refreshToken: newRefreshToken,
        };
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