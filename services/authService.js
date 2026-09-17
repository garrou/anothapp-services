import UserRepository from "../repositories/userRepository.js";
import UserProfile from "../models/userProfile.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import { DUPLICATE_ERROR_CODE, ERROR_LOGIN_PASSWORD, ERROR_REFRESH_TOKEN_INVALID } from "../constants/errors.js";
import { DUMMY_HASH } from "../constants/security.js";
import { DELETION_GRACE_DAYS } from "../constants/deletion.js";
import RefreshTokenRepository from "../repositories/refreshTokenRepository.js";

const GRACE_PERIOD_MS = DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export default class AuthService {
    constructor() {
        this._userRepository = new UserRepository();
        this._refreshTokenRepository = new RefreshTokenRepository();
    }

    /**
     * @param {string?} identifier
     * @param {string?} password
     * @returns {Promise<Object>} a normal session, or {pendingDeletion: true, cancellationToken} when the
     * account is scheduled for deletion - the caller must not open a session in that case
     */
    login = async (identifier, password) => {
        if (!Validator.isString(identifier) || !Validator.isString(password)) {
            throw new ServiceError(400, "Identifiant ou mot de passe incorrect");
        }
        const found = await this._userRepository.getUserByIdentifier(identifier);
        const hashToCompare = found?.password ?? DUMMY_HASH;
        const same = await SecurityHelper.comparePassword(password, hashToCompare);

        if (!found || !same) {
            throw new ServiceError(400, ERROR_LOGIN_PASSWORD);
        }
        if (found.deletedAt) {
            const gracePeriodElapsed = Date.now() - new Date(found.deletedAt).getTime() >= GRACE_PERIOD_MS;

            if (gracePeriodElapsed) {
                throw new ServiceError(400, ERROR_LOGIN_PASSWORD);
            }
            const cancellationToken = SecurityHelper.signJwt(found.id, SecurityHelper.deletionCancellationSecret());
            return { pendingDeletion: true, cancellationToken };
        }
        return this.#issueSession(found);
    }

    /**
     * @param {string} cancellationToken
     * @returns {Promise<Object>}
     */
    cancelDeletion = async (cancellationToken) => {
        const { sub: userId } = SecurityHelper.verifyJwt(cancellationToken, SecurityHelper.deletionCancellationSecret());
        const cancelled = await this._userRepository.cancelDeletion(userId);

        if (!cancelled) {
            throw new ServiceError(500, "Impossible d'annuler la suppression du compte");
        }
        const user = await this._userRepository.getUserById(userId);
        return this.#issueSession(user);
    }

    /**
     * @param {User} user
     * @returns {Promise<Object>}
     */
    #issueSession = async (user) => {
        const token = SecurityHelper.signJwt(user.id, process.env.JWT_SECRET);
        const refreshToken = SecurityHelper.generateRefreshToken();
        const created = await this._refreshTokenRepository.create(
            user.id,
            SecurityHelper.hashToken(refreshToken),
            new Date(Date.now() + SecurityHelper.refreshTokenExpires)
        );

        if (!created) {
            throw new ServiceError(500, "Erreur durant l'authentification");
        }
        return { token, refreshToken, user: new UserProfile(user, true) };
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
            if (err.code === DUPLICATE_ERROR_CODE) {
                throw new ServiceError(409, "Un compte est déjà associé à ces informations");
            }
            throw err;
        }
    }
}