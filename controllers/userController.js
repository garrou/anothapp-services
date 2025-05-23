import UserService from "../services/userService.js";

export default class UserController {
    constructor() {
        this._userService = new UserService();
    }

    getUsers = async (req, res, next) => {
        try {
            const {username} = req.query;
            const users = await this._userService.getUsers(req.userId, username);
            res.status(200).json(users);
        } catch (e) {
            next(e);
        }
    }

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

    changeProfile = async (req, res, next) => {
        try {
            const {currentPassword, newPassword, confirmPassword, email, newEmail, image} = req.body;
            const message = await this._userService.changeProfile(req.userId, currentPassword, newPassword, confirmPassword, email, newEmail, image);
            res.status(200).json({message});
        } catch (e) {
            next(e);
        }
    }
}