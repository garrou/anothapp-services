import UserService from "../services/userService.js";

export default class UserController {
    constructor() {
        this.userService = new UserService();
    }

    getUser = async (req, res, next) => {
        try {
            const {username} = req.body;
            const users = await this.userService.getUser(req.userId, username);
            res.status(200).json(users);
        } catch (e) {
            next(e);
        }
    }

    getProfile = async (req, res, next) => {
        try {
            const {id} = req.params;
            const profile = await this.userService.getProfile(id ?? req.userId, id === req.userId);
            res.status(200).json(profile);
        } catch (e) {
            next(e);
        }
    }

    changeProfile = async (req, res, next) => {
        try {
            const {currentPassword, newPassword, confirmPassword, email, newEmail, image} = req.body;
            const message = await this.userService.changeProfile(req.userId, currentPassword, newPassword, confirmPassword, email, newEmail, image);
            res.status(200).json({ message });
        } catch (e) {
            next(e);
        }
    }
}