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

    login = async (req, res, next) => {
        try {
            const { identifier, password } = req.body;
            const { token, refreshToken, user } = await this._authService.login(identifier, password);

            res.cookie("access_token", token, {
                httpOnly: true,
                secure: isProdMode(),
                sameSite: "lax",
                maxAge: SecurityHelper.jwtTokenExpires,
                path: "/",
            });
            res.cookie("refresh_token", refreshToken, {
                httpOnly: true,
                secure: isProdMode(),
                sameSite: "lax",
                maxAge: SecurityHelper.refreshTokenExpires,
                path: "/auth/refresh",
            });
            res.status(200).json(user);
        } catch (e) {
            next(e);
        }
    }

    logout = (req, res, next) => {
        try {
            res.clearCookie("access_token", {
                httpOnly: true,
                secure: isProdMode(),
                sameSite: "lax",
                path: "/",
            });
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    refreshToken = (req, res, next) => {
        try {
            const refreshToken = req.cookies["refresh_token"];
            this._authService.refreshToken(refreshToken);
        } catch (e) {
            next(e);
        }
    }

    register = async (req, res, next) => {
        try {
            const { email, username, password, confirm } = req.body;
            await this._authService.register(email, username, password, confirm);
            res.status(201).json({ "message": "Compte créé" });
        } catch (e) {
            next(e);
        }
    }
}