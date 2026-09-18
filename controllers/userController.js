import UserService from "../services/userService.js";
import UserUpdate from "../models/userUpdate.js";
import { isProdMode } from "../helpers/utils.js";
import SecurityHelper from "../helpers/security.js";

export default class UserController {
    constructor() {
        this._userService = new UserService();
    }

    /**
     * @returns {Promise<void>}
     */
    getUsers = async (req, res, next) => {
        try {
            const {username} = req.query;
            const users = await this._userService.getUsers(req.userId, username);
            res.status(200).json(users);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    getProfile = async (req, res, next) => {
        try {
            const {id} = req.params;
            const isCurrentUser = !id || id === req.userId;
            const profile = await this._userService.getProfile(id ?? req.userId, isCurrentUser);
            res.status(200).json(profile);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    changeProfile = async (req, res, next) => {
        try {
            const message = await this._userService.updateUser(req.userId, new UserUpdate(req.body));
            res.status(200).json({message});
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    requestDeletion = async (req, res, next) => {
        try {
            const { password } = req.body;
            await this._userService.requestDeletion(req.userId, password);

            this.#clearAuthCookies(res);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    #clearAuthCookies = (res) => {
        const sameSite = isProdMode() ? "none" : "lax";

        res.clearCookie("access_token", { httpOnly: true, secure: isProdMode(), sameSite, path: "/" });
        res.clearCookie("refresh_token", { httpOnly: true, secure: isProdMode(), sameSite, path: SecurityHelper.refreshPath });
    }
}