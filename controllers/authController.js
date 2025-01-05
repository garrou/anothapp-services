import UserService from "../services/userService.js";

export default class AuthController {
    constructor() {
        this.userService = new UserService();
    }

    checkUser = (_, res) => {
        res.sendStatus(200);
    }

    login = async (req, res, next) => {
        try {
            const {identifier, password} = req.body;
            const response = await this.userService.login(identifier, password);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    register = async (req, res, next) => {
        try {
            const {email, username, password, confirm} = req.body;
            await this.userService.register(email, username, password, confirm);
            res.status(201).json({"message": "Compte créé"});
        } catch (e) {
            next(e);
        }
    }
}