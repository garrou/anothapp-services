import UserRepository from "../repositories/userRepository.js";
import UserAuthRepository from "../repositories/userAuthRepository.js";
import LoginChallengeRepository from "../repositories/loginChallengeRepository.js";
import UserProfile from "../models/userProfile.js";
import ServiceError from "../helpers/serviceError.js";
import SecurityHelper from "../helpers/security.js";
import Validator from "../helpers/validator.js";
import {
    DUPLICATE_ERROR_CODE, ERROR_INVALID_REQUEST, ERROR_LOGIN_CODE_EXPIRED, ERROR_LOGIN_CODE_INVALID,
    ERROR_LOGIN_PASSWORD, ERROR_REFRESH_TOKEN_INVALID, ERROR_TOKEN_INVALID
} from "../constants/errors.js";
import { DUMMY_HASH, MAX_LOGIN_CODE_ATTEMPTS } from "../constants/security.js";
import { DELETION_GRACE_DAYS } from "../constants/deletion.js";
import RefreshTokenRepository from "../repositories/refreshTokenRepository.js";
import MailerService from "./mailerService.js";
import { sanitizeErrorForLog } from "../helpers/utils.js";

const GRACE_PERIOD_MS = DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
// keep in sync with the "10m" JWT expiry passed to signJwt in login()
const LOGIN_CODE_EXPIRY_MS = 10 * 60 * 1000;

export default class AuthService {
    constructor() {
        this._userRepository = new UserRepository();
        this._userAuthRepository = new UserAuthRepository();
        this._loginChallengeRepository = new LoginChallengeRepository();
        this._refreshTokenRepository = new RefreshTokenRepository();
        this._mailerService = new MailerService();
    }

    /**
     * A correct password never opens a session on its own: every login (a brand-new unverified
     * account's first one included) needs its code confirmed through confirmLogin. This also
     * closes the old email-verified/not-verified oracle, since both cases now get the exact same
     * {pendingApproval} response.
     * @param {string?} identifier
     * @param {string?} password
     * @returns {Promise<Object>} {pendingApproval: true, approvalToken}, or {pendingDeletion: true,
     * cancellationToken} when the account is scheduled for deletion
     */
    login = async (identifier, password) => {
        if (!Validator.isString(identifier) || !Validator.isString(password)) {
            throw new ServiceError(400, "Identifiant ou mot de passe incorrect");
        }
        const found = await this._userAuthRepository.findForLogin(identifier);
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
        const code = SecurityHelper.generateLoginCode();
        const codeHash = SecurityHelper.hashToken(code);
        const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRY_MS);
        const challengeId = await this._loginChallengeRepository.create(found.id, codeHash, expiresAt);

        // jti ties this token to this specific challenge, so a token from a login() call that's
        // since been superseded by another one can't be paired with the newer challenge's code
        const approvalToken = SecurityHelper.signJwt(found.id, SecurityHelper.loginApprovalSecret(), "10m", { jti: challengeId });

        await this._mailerService.sendLoginCodeEmail(found.email, code);
        return { pendingApproval: true, approvalToken };
    }

    /**
     * Confirms the code sent by login and opens the session - also marks the account's email as
     * verified if it wasn't already, since receiving and typing back this code already proves
     * ownership of the address.
     *
     * The code is checked against its stored hash and consumed in the same atomic UPDATE
     * (LoginChallengeRepository.confirm), so two concurrent calls with the same valid
     * (approvalToken, code) can't both succeed - only whichever runs first still finds a matching
     * row. A wrong guess is likewise recorded with a bounded, atomic increment
     * (incrementAttempts), so the attempt count can't be raced past MAX_LOGIN_CODE_ATTEMPTS
     * either. This is on top of the IP-based confirmLoginLimiter: a wrong guess only costs one of
     * MAX_LOGIN_CODE_ATTEMPTS regardless of which IP it comes from.
     * @param {string?} approvalToken
     * @param {string?} code
     * @returns {Promise<Object>}
     */
    confirmLogin = async (approvalToken, code) => {
        if (!Validator.isString(approvalToken) || !Validator.isString(code)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const { sub: userId, jti: challengeId } = SecurityHelper.verifyJwt(approvalToken, SecurityHelper.loginApprovalSecret());
        const challenge = await this._loginChallengeRepository.getMostRecentByUserId(userId);

        // advisory only (a stale read, not the security boundary) - lets a token from an already
        // superseded/expired/maxed-out/confirmed challenge fail fast with a clearer error,
        // without writing a failed attempt against whatever challenge (if any) is now active
        const noActiveChallenge = !challenge
            || challenge.id !== challengeId
            || challenge.confirmedAt
            || new Date(challenge.expiresAt) < new Date()
            || challenge.attempts >= MAX_LOGIN_CODE_ATTEMPTS;

        if (noActiveChallenge) {
            throw new ServiceError(401, ERROR_LOGIN_CODE_EXPIRED);
        }
        const codeHash = SecurityHelper.hashToken(code);
        const confirmed = await this._loginChallengeRepository.confirm(userId, challengeId, codeHash);

        if (!confirmed) {
            await this._loginChallengeRepository.incrementAttempts(userId, challengeId);
            throw new ServiceError(401, ERROR_LOGIN_CODE_INVALID);
        }
        const user = await this.#getFullUser(userId);

        if (!user) {
            throw new ServiceError(401, ERROR_TOKEN_INVALID);
        }
        if (!user.emailVerified) {
            const updated = await this._userAuthRepository.updateField(userId, "email_verified", true);

            if (!updated) {
                throw new ServiceError(400, "Impossible de confirmer cet email");
            }
            user.emailVerified = true;
        }
        return this.#issueSession(user);
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
        const user = await this.#getFullUser(userId);
        return this.#issueSession(user);
    }

    /**
     * Combines the account's business row (`users`) and auth row (`users_auth`) into the single
     * shape UserProfile and the rest of this service expect - the two live in separate tables and
     * repositories, but almost every auth flow needs fields from both.
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    #getFullUser = async (userId) => {
        const user = await this._userRepository.getUserById(userId);

        if (!user) {
            return null;
        }
        const auth = await this._userAuthRepository.getByUserId(userId);
        return { ...user, ...auth };
    }

    /**
     * @param {Object} user
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

        try {
            const userId = await this._userRepository.createUser(email, hash, username);
            if (!userId) throw new ServiceError(500, "Impossible de créer le compte");
        } catch (err) {
            if (err.code === DUPLICATE_ERROR_CODE) {
                throw new ServiceError(409, "Un compte est déjà associé à ces informations");
            }
            throw err;
        }
    }

    /**
     * @param {string} token
     * @returns {Promise<void>}
     */
    verifyEmail = async (token) => {
        const { sub: userId } = SecurityHelper.verifyJwt(token, SecurityHelper.emailVerificationSecret());
        const auth = await this._userAuthRepository.getByUserId(userId);

        // a pending_email means this token confirms an email *change* (see UserService.#changeEmail)
        // rather than the initial registration - move it into email instead of touching
        // email_verified, which never left true for the account's already-proven old address
        if (auth?.pendingEmail) {
            let updated;

            try {
                updated = await this._userAuthRepository.confirmPendingEmail(userId);
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
        const updated = await this._userAuthRepository.updateField(userId, "email_verified", true);

        if (!updated) {
            throw new ServiceError(400, "Impossible de confirmer cet email");
        }
    }

    /**
     * Always resolves the same way whether or not the email has an account, so this endpoint
     * can't be used to enumerate accounts.
     * @param {string?} email
     * @returns {Promise<void>}
     */
    forgotPassword = async (email) => {
        if (!Validator.isString(email)) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const auth = await this._userAuthRepository.getByEmail(email);

        if (auth) {
            const token = SecurityHelper.signJwt(auth.userId, SecurityHelper.passwordResetSecret(auth.password), "1h");
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
        let auth = null;

        try {
            auth = decoded?.sub ? await this._userAuthRepository.getByUserId(decoded.sub) : null;
        } catch {
            // e.g. a malformed `sub` that isn't even a valid UUID - treat exactly like "no user"
            auth = null;
        }
        if (!auth) {
            throw new ServiceError(401, ERROR_TOKEN_INVALID);
        }
        const { sub: userId } = SecurityHelper.verifyJwt(token, SecurityHelper.passwordResetSecret(auth.password));
        const validation = Validator.isValidPassword(password, confirm);

        if (!validation.status) {
            throw new ServiceError(400, validation.message);
        }
        const hash = await SecurityHelper.createHash(password);
        const updated = await this._userAuthRepository.updateField(userId, "password_hash", hash);

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
