import AuthService from "../services/authService.js";

export default class AuthController {
    constructor() {
        this.authService = new AuthService();
    }

    checkUser = (_, res) => {
        res.sendStatus(200);
    }

    login = async (req, res, next) => {
        try {
            const {identifier, password} = req.body;
            const response = await this.authService.login(identifier, password);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    register = async (req, res, next) => {
        try {
            const {email, username, password, confirm} = req.body;
            await this.authService.register(email, username, password, confirm);
            res.status(201).json({"message": "Compte créé"});
        } catch (e) {
            next(e);
        }
    }
}