import AuthService from "../services/authService.js";
import { isProdMode } from "../helpers/utils.js";
import SecurityHelper from "../helpers/security.js";

export default class AuthController {
    constructor() {
        this._authService = new AuthService();
    }

    checkUser = (_, res) => {
        res.sendStatus(200);
    }

    /**
     * @returns {Promise<void>}
     */
    login = async (req, res, next) => {
        try {
            const { identifier, password } = req.body;
            const result = await this._authService.login(identifier, password);

            if (result.pendingDeletion) {
                return res.status(200).json({ pendingDeletion: true, cancellationToken: result.cancellationToken });
            }
            const { token, refreshToken, user } = result;
            this.#setAuthCookies(res, token, refreshToken);

            if (this.#isNativeClient(req)) {
                return res.status(200).json({ token, refreshToken, ...user });
            }
            res.status(200).json(user);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    cancelDeletion = async (req, res, next) => {
        try {
            const { cancellationToken } = req.body;
            const { token, refreshToken, user } = await this._authService.cancelDeletion(cancellationToken);

            this.#setAuthCookies(res, token, refreshToken);

            if (this.#isNativeClient(req)) {
                return res.status(200).json({ token, refreshToken, ...user });
            }
            res.status(200).json(user);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    logout = async (req, res, next) => {
        try {
            const refreshToken = req.cookies["refresh_token"]
                ?? SecurityHelper.extractBearerToken(req.headers["authorization"]);
            await this._authService.logout(refreshToken);

            this.#clearAuthCookies(res);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    refreshToken = async (req, res, next) => {
        try {
            const refreshToken = req.cookies["refresh_token"]
                ?? SecurityHelper.extractBearerToken(req.headers["authorization"]);

            if (!refreshToken) {
                return res.status(401).json({ "message": "Utilisateur non connecté" });
            }
            const { accessToken, refreshToken: newRefreshToken } = await this._authService.refreshToken(refreshToken);

            this.#setAuthCookies(res, accessToken, newRefreshToken);

            if (this.#isNativeClient(req)) {
                return res.status(200).json({ token: accessToken, refreshToken: newRefreshToken });
            }
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    register = async (req, res, next) => {
        try {
            const { email, username, password, confirm } = req.body;
            await this._authService.register(email, username, password, confirm);
            res.status(201).json({ "message": "Compte créé" });
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    verifyEmail = async (req, res, next) => {
        try {
            const { token } = req.body;
            await this._authService.verifyEmail(token);
            res.status(200).json({ "message": "Email confirmé" });
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    resendVerification = async (req, res, next) => {
        try {
            const { email } = req.body;
            await this._authService.resendVerification(email);
            res.status(200).json({ "message": "Email de confirmation envoyé" });
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    forgotPassword = async (req, res, next) => {
        try {
            const { email } = req.body;
            await this._authService.forgotPassword(email);
            res.status(200).json({ "message": "Email de réinitialisation envoyé" });
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    resetPassword = async (req, res, next) => {
        try {
            const { token, password, confirm } = req.body;
            await this._authService.resetPassword(token, password, confirm);
            res.status(200).json({ "message": "Mot de passe réinitialisé" });
        } catch (e) {
            next(e);
        }
    }

    #setAuthCookies = (res, accessToken, refreshToken) => {
        const sameSite = isProdMode() ? "none" : "lax";

        res.cookie("access_token", accessToken, {
            httpOnly: true,
            secure: isProdMode(),
            sameSite,
            maxAge: SecurityHelper.jwtTokenExpires,
            path: "/",
        });
        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure: isProdMode(),
            sameSite,
            maxAge: SecurityHelper.refreshTokenExpires,
            path: SecurityHelper.refreshPath
        });
    }

    #clearAuthCookies = (res) => {
        const sameSite = isProdMode() ? "none" : "lax";

        res.clearCookie("access_token", { httpOnly: true, secure: isProdMode(), sameSite, path: "/" });
        res.clearCookie("refresh_token", { httpOnly: true, secure: isProdMode(), sameSite, path: SecurityHelper.refreshPath });
    }

    #isNativeClient = (req) => req.headers["x-client-type"] === "ios";
}