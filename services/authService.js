import UserRepository from "../repositories/userRepository.js";
import UserProfile from "../models/userProfile.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import {
    DUPLICATE_ERROR_CODE, ERROR_EMAIL_NOT_VERIFIED, ERROR_INVALID_REQUEST, ERROR_LOGIN_PASSWORD,
    ERROR_REFRESH_TOKEN_INVALID, ERROR_TOKEN_INVALID
} from "../constants/errors.js";
import { DUMMY_HASH } from "../constants/security.js";
import { DELETION_GRACE_DAYS } from "../constants/deletion.js";
import RefreshTokenRepository from "../repositories/refreshTokenRepository.js";
import MailerService from "./mailerService.js";
import { sanitizeErrorForLog } from "../helpers/utils.js";

const GRACE_PERIOD_MS = DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export default class AuthService {
    constructor() {
        this._userRepository = new UserRepository();
        this._refreshTokenRepository = new RefreshTokenRepository();
        this._mailerService = new MailerService();
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
        if (!found.emailVerified) {
            throw new ServiceError(403, ERROR_EMAIL_NOT_VERIFIED);
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
     * @returns {Promise<void>}
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
     * @returns {Promise<{accessToken: string, refreshToken: string}>}
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
        let userId;

        try {
            userId = await this._userRepository.createUser(email, hash, username);
            if (!userId) throw new ServiceError(500, "Impossible de créer le compte");
        } catch (err) {
            if (err.code === DUPLICATE_ERROR_CODE) {
                throw new ServiceError(409, "Un compte est déjà associé à ces informations");
            }
            throw err;
        }

        this.issueEmailVerification(userId, email).catch((err) => {
            console.error("Échec de l'envoi de l'email de confirmation", sanitizeErrorForLog(err));
        });
    }

    /**
     * @param {string} token
     * @returns {Promise<void>}
     */
    verifyEmail = async (token) => {
        const { sub: userId } = SecurityHelper.verifyJwt(token, SecurityHelper.emailVerificationSecret());
        const user = await this._userRepository.getUserById(userId);

        if (user?.pendingEmail) {
            let updated;

            try {
                updated = await this._userRepository.confirmPendingEmail(userId);
            } catch (err) {
                if (err.code === DUPLICATE_ERROR_CODE) {
                    throw new ServiceError(409, "Cet email est déjà associé à un compte");
                }
                throw err;
            }
            if (!updated) {
                throw new ServiceError(400, "Impossible de confirmer cet email");
            }
            return;
        }
        const updated = await this._userRepository.updateField(userId, "email_verified", true);

        if (!updated) {
            throw new ServiceError(400, "Impossible de confirmer cet email");
        }
    }

    /**
     * Accepts a username or an email, exactly like login - so a user who signed up and then
     * tried logging in with their username can resend without having to remember/re-type their
     * email. The link always goes to the account's real email (never to the raw identifier,
     * which may not be an address at all). Always resolves the same way regardless of whether
     * the account exists or is already verified - the caller (see authController.js) reports
     * one generic success message either way, so this endpoint can't be used to enumerate
     * accounts.
     * @param {string?} identifier
     * @returns {Promise<void>}
     */
    resendVerification = async (identifier) => {
        if (!Validator.isString(identifier)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const user = await this._userRepository.getUserByIdentifier(identifier);

        if (user && !user.emailVerified) {
            this.issueEmailVerification(user.id, user.email).catch((err) => {
                console.error("Échec de l'envoi de l'email de confirmation", sanitizeErrorForLog(err));
            });
        }
    }

    /**
     * Always resolves the same way whether or not the email has an account - see
     * resendVerification for why (this endpoint has the exact same enumeration risk).
     * @param {string?} email
     * @returns {Promise<void>}
     */
    forgotPassword = async (email) => {
        if (!Validator.isString(email)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const user = await this._userRepository.getUserByEmail(email);

        if (user) {
            const token = SecurityHelper.signJwt(user.id, SecurityHelper.passwordResetSecret(user.password), "1h");
            const url = `${process.env.ORIGIN}/reset-password/${token}`;

            this._mailerService.sendPasswordResetEmail(email, url).catch((err) => {
                console.error("Échec de l'envoi de l'email de réinitialisation", sanitizeErrorForLog(err));
            });
        }
    }

    /**
     * The token's signature is checked against a secret derived from the target account's
     * *current* password hash (see SecurityHelper.passwordResetSecret), so its `sub` claim can't
     * be trusted until that account is looked up - decoding it first (without verifying) is only
     * used to know which user's hash to derive the secret from.
     * @param {string} token
     * @param {string?} password
     * @param {string?} confirm
     * @returns {Promise<void>}
     */
    resetPassword = async (token, password, confirm) => {
        const decoded = SecurityHelper.decodeJwt(token);
        let user = null;

        try {
            user = decoded?.sub ? await this._userRepository.getUserById(decoded.sub) : null;
        } catch {
            // e.g. a malformed `sub` that isn't even a valid UUID - treat exactly like "no user"
            user = null;
        }
        if (!user) {
            throw new ServiceError(401, ERROR_TOKEN_INVALID);
        }
        const { sub: userId } = SecurityHelper.verifyJwt(token, SecurityHelper.passwordResetSecret(user.password));
        const validation = Validator.isValidPassword(password, confirm);

        if (!validation.status) {
            throw new ServiceError(400, validation.message);
        }
        const hash = await SecurityHelper.createHash(password);
        const updated = await this._userRepository.updateField(userId, "password", hash);

        if (!updated) {
            throw new ServiceError(500, "Impossible de réinitialiser le mot de passe");
        }
        await this._refreshTokenRepository.revokeAllForUser(userId);
    }

    /**
     * @param {string} userId
     * @param {string} email
     * @returns {Promise<void>}
     */
    issueEmailVerification = async (userId, email) => {
        const token = SecurityHelper.signJwt(userId, SecurityHelper.emailVerificationSecret(), "1d");
        const url = `${process.env.ORIGIN}/verify-email/${token}`;
        await this._mailerService.sendVerificationEmail(email, url);
    }
}