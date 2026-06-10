import {Router} from "express";
import AuthController from "../controllers/authController.js";
import { loginLimiter } from "../middlewares/rateLimit.js";

const router = new Router();
const authController = new AuthController();

router.get("/me", authController.checkUser);

router.post("/register", authController.register);

router.post("/login", loginLimiter, authController.login);

export default router;